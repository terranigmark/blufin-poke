"""JSON API: the public menu the website reads, and the editor behind blufinpoke.com/login.

Auth follows Cervesoft's taplist-admin: email + password returns a JWT pair, and
the editor sends `Authorization: Bearer <access>`. Only menu editors (owners and
employees marked "puede editar el menú") get tokens or write access.
"""

import base64
import binascii
import re

from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils.text import slugify
from rest_framework import permissions, routers, serializers, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView

from .models import Beer, Category, Drink, Extra, Highlight, HouseBowl, Ingredient, Settings, Size


class IsMenuEditor(permissions.BasePermission):
    # Checked on every request, so taking the flag away locks her out before the token expires.
    def has_permission(self, request, view):
        return getattr(request.user, "is_menu_editor", False)


class LoginSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        if not self.user.is_menu_editor:
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

class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [IsMenuEditor]

    def perform_destroy(self, category):
        if category.builtin:
            raise ValidationError("Esta sección viene con el menú y no se puede eliminar.")
        Drink.objects.filter(category=category.key).delete()
        category.delete()


router = routers.SimpleRouter(trailing_slash=True)
router.register("editor/categories", CategoryViewSet, basename="categories")
router.register(
    "editor/highlights",
    type(
        "HighlightViewSet",
        (viewsets.ModelViewSet,),
        {"queryset": Highlight.objects.all(), "serializer_class": HighlightSerializer, "permission_classes": [IsMenuEditor]},
    ),
    basename="highlights",
)
for name, model in MODELS.items():
    router.register(
        f"editor/{name}",
        type(
            f"{model.__name__}ViewSet",
            (viewsets.ModelViewSet,),
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
@permission_classes([IsMenuEditor])
def editor_menu(request):
    """Everything, hidden items included, in one request for the editor's first load."""
    return Response(
        {
            **{name: SERIALIZERS[name](model.objects.all(), many=True).data for name, model in MODELS.items()},
            **page_extras(),
        }
    )


@api_view(["GET", "PATCH"])
@permission_classes([IsMenuEditor])
def editor_settings(request):
    serializer = SettingsSerializer(Settings.get(), data=request.data, partial=True)
    if request.method == "PATCH":
        serializer.is_valid(raise_exception=True)
        serializer.save()
    return Response(SettingsSerializer(serializer.instance).data)


def highlight_image(request, pk):
    """An uploaded highlight's picture. Highlights are never edited, only added and removed, so it caches forever."""
    highlight = get_object_or_404(Highlight, pk=pk, url="")
    response = HttpResponse(bytes(highlight.image), content_type=highlight.content_type)
    response["Cache-Control"] = "public, max-age=31536000, immutable"
    return response
