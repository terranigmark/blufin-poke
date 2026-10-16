"""JSON API: the public menu the website reads, and the editor behind blufinpoke.com/login.

Auth follows Cervesoft's taplist-admin: email + password returns a JWT pair, and
the editor sends `Authorization: Bearer <access>`. Only menu editors (owners and
employees marked "puede editar el menú") get tokens or write access.
"""

import base64
import binascii
import re

from datetime import timedelta

from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.text import slugify
from rest_framework import permissions, routers, serializers, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView

from accounts.models import Activity

from .models import Beer, Category, Drink, Extra, Highlight, HouseBowl, Ingredient, Landing, Media, Settings, Size


class IsMenuEditor(permissions.BasePermission):
    # Checked on every request, so taking the flag away locks her out before the token expires.
    def has_permission(self, request, view):
        return getattr(request.user, "is_menu_editor", False)


class IsLandingEditor(permissions.BasePermission):
    def has_permission(self, request, view):
        return getattr(request.user, "is_landing_editor", False)


class HasEditorAccess(permissions.BasePermission):
    """Signed in to /admin: may change the menu, the home page, or both."""

    def has_permission(self, request, view):
        return getattr(request.user, "has_editor_access", False)


def shown(value):
    """A value as the activity log shows it."""
    if isinstance(value, (bytes, memoryview)):
        return "(imagen nueva)"
    if isinstance(value, bool):
        return "sí" if value else "no"
    text = str(value) if value not in ("", None) else "(vacío)"
    return text if len(text) <= 60 else text[:59] + "…"


def changes(obj, old):
    """"precio (MXN): 235 → 250; disponible: sí → no" for the fields that changed."""
    return "; ".join(
        f"{obj._meta.get_field(f).verbose_name}: {shown(v)} → {shown(getattr(obj, f))}"
        for f, v in old.items()
        if v != getattr(obj, f) and f != "content_type"
    )


class LoggedViewSet(viewsets.ModelViewSet):
    """Every add, change and delete goes in the admins' activity log, with the item's name."""

    def label(self, obj):
        return f"{obj._meta.verbose_name} “{obj}”"

    def perform_create(self, serializer):
        obj = serializer.save()
        Activity.record(self.request, f"Añadió {self.label(obj)}")

    def perform_update(self, serializer):
        old = {f: getattr(serializer.instance, f) for f in serializer.validated_data}
        obj = serializer.save()
        if diff := changes(obj, old):
            Activity.record(self.request, f"Cambió {self.label(obj)}: {diff}")

    def perform_destroy(self, obj):
        Activity.record(self.request, f"Eliminó {self.label(obj)}")
        obj.delete()


class LoginSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        if not self.user.has_editor_access:
            raise PermissionDenied("Esta cuenta no tiene acceso al editor del menú.")
        data["user"] = {"email": self.user.email, "name": self.user.get_full_name()}
        return data


class LoginView(TokenObtainPairView):
    serializer_class = LoginSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"


class MenuItemSerializer(serializers.ModelSerializer):
    """All fields; `key` is generated from the name when the editor leaves it out."""

    def to_internal_value(self, data):
        # Before validation, so the unique (step, key) check sees the generated key.
        if self.instance is None and "key" in self.fields and not data.get("key") and data.get("name"):
            data = {**data, "key": self.unique_key(data)}
        return super().to_internal_value(data)

    def unique_key(self, data):
        model = self.Meta.model
        scope = {"step": data.get("step")} if model is Ingredient else {}
        base = slugify(data["name"])[:40] or "item"
        key, n = base, 2
        while model.objects.filter(key=key, **scope).exists():
            key, n = f"{base}-{n}", n + 1
        return key


def validate_drink_category(self, value):
    if not Category.objects.filter(key=value, kind="drinks").exists():
        raise ValidationError("No existe esa lista.")
    return value


def serializer_for(model):
    meta = type("Meta", (), {"model": model, "fields": "__all__"})
    attrs = {"Meta": meta}
    if hasattr(model, "key"):
        meta.extra_kwargs = {"key": {"required": False}}
    if model is Drink:
        attrs["validate_category"] = validate_drink_category
    return type(f"{model.__name__}Serializer", (MenuItemSerializer,), attrs)


MODELS = {"sizes": Size, "ingredients": Ingredient, "extras": Extra, "beers": Beer, "drinks": Drink, "bowls": HouseBowl}
SERIALIZERS = {name: serializer_for(model) for name, model in MODELS.items()}


class CategorySerializer(serializers.ModelSerializer):
    """Sections: rename, reorder and hide any; only price lists are added (and deleted, in the view)."""

    class Meta:
        model = Category
        fields = "__all__"
        read_only_fields = ("key", "kind", "builtin")

    def validate_group(self, value):
        # Built-in sections stay where they are; price lists (new ones included) go in Bebidas or Otros.
        fixed = self.instance and self.instance.kind != "drinks"
        if (value != self.instance.group) if fixed else (value == "poke"):
            raise ValidationError("Solo las listas de precios cambian de grupo, entre Bebidas y Otros.")
        return value

    def validate_available(self, value):
        if not value and self.instance and self.instance.in_builder:
            raise ValidationError("Arma tu poke necesita esta sección, así que no se puede ocultar.")
        return value

    def create(self, data):
        base = slugify(data["name"])[:40] or "lista"
        key, n = base, 2
        while Category.objects.filter(key=key).exists():
            key, n = f"{base}-{n}", n + 1
        return Category.objects.create(**data, key=key, kind="drinks")


class SettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = Settings
        exclude = ("id",)


HIGHLIGHT_MAX_BYTES = 1_500_000  # the editor shrinks photos to 1080p first, like Cervesoft
DATA_URL = re.compile(r"data:(image/(?:jpeg|png|webp|gif));base64,(.+)", re.S)


class HighlightSerializer(serializers.ModelSerializer):
    # Uploads arrive as a data: URL and are stored as bytes; `src` is where the website loads them from.
    image = serializers.CharField(write_only=True, required=False, allow_blank=True)
    src = serializers.SerializerMethodField()

    class Meta:
        model = Highlight
        fields = ("id", "order", "url", "image", "src")

    def get_src(self, h):
        return h.url or f"/api/highlights/{h.pk}/image/"

    def validate_url(self, value):
        if value and not value.startswith("https://"):
            raise ValidationError("El enlace debe empezar con https://.")
        return value

    def validate(self, attrs):
        image = attrs.pop("image", "")
        if self.instance is None and bool(image) == bool(attrs.get("url")):
            raise ValidationError("Sube una imagen o pega un enlace.")
        if image:
            m = DATA_URL.fullmatch(image)
            try:
                raw = base64.b64decode(m[2], validate=True) if m else b""
            except binascii.Error:
                raw = b""
            if not raw:
                raise ValidationError({"image": "Esa imagen no se pudo leer. Usa JPG, PNG, WebP o GIF."})
            if len(raw) > HIGHLIGHT_MAX_BYTES:
                raise ValidationError({"image": "La imagen pesa más de 1.5 MB."})
            attrs.update(image=raw, content_type=m[1])
        return attrs

class CategoryViewSet(LoggedViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [IsMenuEditor]

    def perform_destroy(self, category):
        if category.builtin:
            raise ValidationError("Esta sección viene con el menú y no se puede eliminar.")
        Drink.objects.filter(category=category.key).delete()
        super().perform_destroy(category)


router = routers.SimpleRouter(trailing_slash=True)
router.register("editor/categories", CategoryViewSet, basename="categories")
router.register(
    "editor/highlights",
    type(
        "HighlightViewSet",
        (LoggedViewSet,),
        {"queryset": Highlight.objects.all(), "serializer_class": HighlightSerializer, "permission_classes": [IsMenuEditor]},
    ),
    basename="highlights",
)
for name, model in MODELS.items():
    router.register(
        f"editor/{name}",
        type(
            f"{model.__name__}ViewSet",
            (LoggedViewSet,),
            {
                "queryset": model.objects.all(),
                "serializer_class": SERIALIZERS[name],
                "permission_classes": [IsMenuEditor],
            },
        ),
        basename=name,
    )


def page_extras():
    """Sections, display settings and highlights: the same for the website and the editor."""
    return {
        "categories": CategorySerializer(Category.objects.all(), many=True).data,
        "settings": SettingsSerializer(Settings.get()).data,
        "highlights": HighlightSerializer(Highlight.objects.all(), many=True).data,
        "landing": Landing.get().content,
    }


@api_view(["GET"])
@permission_classes([permissions.AllowAny])
def public_menu(request):
    """What the website shows: available items only, in the editor's order."""
    return Response(
        {
            **{
                name: SERIALIZERS[name](model.objects.filter(available=True), many=True).data
                for name, model in MODELS.items()
            },
            **page_extras(),
        }
    )


@api_view(["GET"])
@permission_classes([HasEditorAccess])
def editor_menu(request):
    """Everything, hidden items included, in one request for the editor's first load."""
    return Response(
        {
            **{name: SERIALIZERS[name](model.objects.all(), many=True).data for name, model in MODELS.items()},
            **page_extras(),
            # Which tabs to show: Menú, Página de inicio, and for admins Usuarios and Actividad.
            "me": {
                "email": request.user.email,
                "admin": request.user.is_superuser,
                "menu": request.user.is_menu_editor,
                "landing": request.user.is_landing_editor,
            },
        }
    )


@api_view(["GET", "PATCH"])
@permission_classes([IsMenuEditor])
def editor_settings(request):
    serializer = SettingsSerializer(Settings.get(), data=request.data, partial=True)
    if request.method == "PATCH":
        serializer.is_valid(raise_exception=True)
        old = {f: getattr(serializer.instance, f) for f in serializer.validated_data}
        if diff := changes(serializer.save(), old):
            Activity.record(request, f"Cambió los ajustes: {diff}")
    return Response(SettingsSerializer(serializer.instance).data)


def highlight_image(request, pk):
    """An uploaded highlight's picture. Highlights are never edited, only added and removed, so it caches forever."""
    highlight = get_object_or_404(Highlight, pk=pk, url="")
    response = HttpResponse(bytes(highlight.image), content_type=highlight.content_type)
    response["Cache-Control"] = "public, max-age=31536000, immutable"
    return response


# ---------------------------------------------------------------- Home page (the /admin "Página de inicio" cards)

MEDIA_SRC = re.compile(r"\A(/(?!/)[\w./-]*|https://\S+)\Z")


def media_link(allow_blank=True):
    """A picture or video: an upload (/api/media/1/), a file of the website (/video/x.mp4) or an https link."""
    return serializers.RegexField(MEDIA_SRC, max_length=300, allow_blank=allow_blank, error_messages={"invalid": "Enlace no válido."})


def line(max_length=120, allow_blank=True, **kw):
    return serializers.CharField(max_length=max_length, allow_blank=allow_blank, **kw)


def pairs(*names, max_length=120):
    """Spanish text plus its optional English, e.g. slogan and slogan_en."""
    return {f"{n}{suffix}": line(max_length) for n in names for suffix in ("", "_en")}


LINK = re.compile(r"\A(/(?!/)\S*|https://\S+)\Z")


class Word(serializers.Serializer):
    text = line(60, allow_blank=False)
    text_en = line(60, required=False, default="")


class Tile(Word):
    image = media_link(allow_blank=False)
    link = serializers.RegexField(LINK, max_length=300, error_messages={"invalid": "Usa una página del sitio (/menu) o un enlace https://."})


class Social(serializers.Serializer):
    network = serializers.ChoiceField(["instagram", "facebook", "tiktok", "x", "youtube", "whatsapp"])
    url = serializers.RegexField(r"\Ahttps://\S+\Z", max_length=300, error_messages={"invalid": "El enlace debe empezar con https://."})


def email():
    return serializers.EmailField(allow_blank=True, max_length=120)


# As the cards in /admin's "Página de inicio" call them, for the activity log.
LANDING_TITLES = {
    "header": "Encabezado",
    "hero": "Portada",
    "belt": "Franja animada",
    "build": "Arma tu poke",
    "cravings": "¿Qué se te antoja?",
    "esencia": "Nuestra esencia es Baja",
    "visit": "Ubicación",
    "footer": "Pie de página",
}

LANDING_SECTIONS = {
    "header": type("Header", (serializers.Serializer,), {"marlin_logo": media_link(), "blufin_logo": media_link()}),
    "hero": type(
        "Hero",
        (serializers.Serializer,),
        {"image": media_link(), "video": media_link(), **pairs("slogan", "lead", "hours", "address"), **pairs("title", max_length=80)},
    ),
    "belt": type("Belt", (serializers.Serializer,), {"words": Word(many=True, max_length=12)}),
    "build": type(
        "Build",
        (serializers.Serializer,),
        {**pairs("title", "lead", "cta"), "steps": Word(many=True, max_length=10), "image": media_link()},
    ),
    "cravings": type("Cravings", (serializers.Serializer,), {**pairs("title"), "tiles": Tile(many=True, max_length=6)}),
    "esencia": type(
        "Esencia",
        (serializers.Serializer,),
        {**pairs("title", "cta"), **pairs("lead", max_length=300), "image_a": media_link(), "image_b": media_link()},
    ),
    "visit": type(
        "Visit",
        (serializers.Serializer,),
        {**pairs("title", "cta"), **pairs("hours", max_length=200), "address": line(200, allow_blank=False), "email": email()},
    ),
    "footer": type(
        "Footer",
        (serializers.Serializer,),
        {
            **pairs("tagline", "copyright"),
            "brand": line(60),
            "city": line(),
            "social": Social(many=True, max_length=6),
            "email": email(),
        },
    ),
}


@api_view(["PATCH"])
@permission_classes([IsLandingEditor])
def editor_landing(request):
    """Replaces the sections sent, each whole; the others stay as they were."""
    unknown = set(request.data) - set(LANDING_SECTIONS)
    if unknown:
        raise ValidationError(f"Sección desconocida: {', '.join(sorted(unknown))}.")
    landing = Landing.get()
    for name, data in request.data.items():
        section = LANDING_SECTIONS[name](data=data)
        if not section.is_valid():
            raise ValidationError({name: section.errors})
        landing.content[name] = section.validated_data
    landing.save()
    Activity.record(request, "Cambió la página de inicio: " + ", ".join(LANDING_TITLES.get(n, n) for n in request.data))
    # Uploads nobody links to any more; a day's grace keeps ones the editor has not saved yet, and Deshacer's.
    used = {int(n) for n in re.findall(r"/api/media/(\d+)/", str(landing.content))}
    Media.objects.filter(created__lt=timezone.now() - timedelta(days=1)).exclude(pk__in=used).delete()
    return Response(landing.content)


MEDIA_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/webm"}
IMAGE_MAX_BYTES = 1_500_000  # the editor shrinks pictures before sending them
VIDEO_MAX_BYTES = 12_000_000


@api_view(["POST"])
@permission_classes([IsLandingEditor])
def editor_media(request):
    """Upload a picture or video as a data: URL; answers with the link to put in the home page."""
    m = re.fullmatch(r"data:([\w/]+);base64,(.+)", str(request.data.get("file", "")), re.S)
    if not m or m[1] not in MEDIA_TYPES:
        raise ValidationError({"file": "Usa una foto JPG, PNG, WebP o GIF, o un video MP4 o WebM."})
    try:
        raw = base64.b64decode(m[2], validate=True)
    except binascii.Error:
        raw = b""
    limit = VIDEO_MAX_BYTES if m[1].startswith("video/") else IMAGE_MAX_BYTES
    if not raw or len(raw) > limit:
        raise ValidationError({"file": f"El archivo está vacío o pesa más de {limit // 1_000_000} MB."})
    media = Media.objects.create(data=raw, content_type=m[1])
    return Response({"src": media.src}, status=201)


def media_file(request, pk):
    """An upload. Never changed once stored, so it caches forever. Answers byte ranges: Safari won't play video otherwise."""
    media = get_object_or_404(Media, pk=pk)
    data = bytes(media.data)
    r = re.fullmatch(r"bytes=(\d*)-(\d*)", request.headers.get("Range", ""))
    if r and (r[1] or r[2]):
        # "bytes=500-" from 500 to the end; "bytes=-500" the last 500.
        start, end = (int(r[1]), int(r[2] or len(data) - 1)) if r[1] else (max(0, len(data) - int(r[2])), len(data) - 1)
        end = min(end, len(data) - 1)
        if start > end:
            response = HttpResponse(status=416)
            response["Content-Range"] = f"bytes */{len(data)}"
            return response
        response = HttpResponse(data[start : end + 1], status=206, content_type=media.content_type)
        response["Content-Range"] = f"bytes {start}-{end}/{len(data)}"
    else:
        response = HttpResponse(data, content_type=media.content_type)
    response["Accept-Ranges"] = "bytes"
    response["Cache-Control"] = "public, max-age=31536000, immutable"
    return response
