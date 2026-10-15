"""JSON API: the public menu the website reads, and the editor behind blufinpoke.com/login.

Auth follows Cervesoft's taplist-admin: email + password returns a JWT pair, and
the editor sends `Authorization: Bearer <access>`. Only menu editors (owners and
employees marked "puede editar el menú") get tokens or write access.
"""

from django.utils.text import slugify
from rest_framework import permissions, routers, serializers, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView

from .models import Beer, Drink, Extra, Ingredient, Size


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


def serializer_for(model):
    meta = type("Meta", (), {"model": model, "fields": "__all__"})
    if hasattr(model, "key"):
        meta.extra_kwargs = {"key": {"required": False}}
    return type(f"{model.__name__}Serializer", (MenuItemSerializer,), {"Meta": meta})


MODELS = {"sizes": Size, "ingredients": Ingredient, "extras": Extra, "beers": Beer, "drinks": Drink}
SERIALIZERS = {name: serializer_for(model) for name, model in MODELS.items()}

router = routers.SimpleRouter(trailing_slash=True)
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


@api_view(["GET"])
@permission_classes([permissions.AllowAny])
def public_menu(request):
    """What the website shows: available items only, in the editor's order."""
    return Response(
        {
            name: SERIALIZERS[name](model.objects.filter(available=True), many=True).data
            for name, model in MODELS.items()
        }
    )


@api_view(["GET"])
@permission_classes([IsMenuEditor])
def editor_menu(request):
    """Everything, hidden items included, in one request for the editor's first load."""
    return Response(
        {name: SERIALIZERS[name](model.objects.all(), many=True).data for name, model in MODELS.items()}
    )
