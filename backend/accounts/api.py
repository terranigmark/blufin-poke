"""The "Usuarios" and "Actividad" tabs in /admin: admins add, edit and remove the people who
update the site, choose what each one may change, and see who changed what in the last 30 days.

Kept in the fields that already exist: an admin is a superuser (everything, users and the
activity log included); an editor changes the menu (`can_edit_menu`), the home page
(`can_edit_landing`), or both.
"""

from django.contrib.auth.password_validation import validate_password
from django.utils import timezone
from django.db.models import Q
from rest_framework import permissions, serializers, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from .models import KEEP_ACTIVITY, Activity, User

ROLES = {"admin": "Admin", "editor": "Editor"}


class IsAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_active and request.user.is_superuser


class UserSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source="first_name", max_length=150, required=False, allow_blank=True)
    role = serializers.ChoiceField(choices=list(ROLES), default="editor", write_only=True)
    active = serializers.BooleanField(source="is_active", default=True)
    # What an editor may change; admins may change everything.
    menu = serializers.BooleanField(source="can_edit_menu", default=True)
    landing = serializers.BooleanField(source="can_edit_landing", default=True)
    # Write only: the temporary password for a new user, or a reset.
    password = serializers.CharField(write_only=True, required=False, trim_whitespace=False)

    class Meta:
        model = User
        fields = ["id", "email", "name", "role", "active", "menu", "landing", "password", "last_login"]
        read_only_fields = ["last_login"]

    def to_representation(self, user):
        data = super().to_representation(user)
        data["role"] = "admin" if user.is_superuser else "editor"
        if user.is_superuser:
            data.update(menu=True, landing=True)
        return data

    def validate_email(self, value):
        return value.strip().lower()

    def validate_password(self, value):
        validate_password(value, self.instance)
        return value

    def validate(self, attrs):
        if not self.instance and not attrs.get("password"):
            raise ValidationError({"password": "Escribe una contraseña temporal."})
        me = self.context["request"].user
        # The signed-in admin is always an active admin, so this also keeps one admin on the site.
        if self.instance == me and (attrs.get("role", "admin") != "admin" or not attrs.get("is_active", True)):
            raise ValidationError("No puedes quitarte el rol de admin ni desactivar tu propia cuenta.")
        role = attrs.get("role", "admin" if self.instance and self.instance.is_superuser else "editor")
        get = lambda f: attrs.get(f, getattr(self.instance, f, True))
        if role == "editor" and not (get("can_edit_menu") or get("can_edit_landing")):
            raise ValidationError("Elige al menos una cosa que pueda cambiar: el menú o la página de inicio.")
        return attrs

    def save(self, **kwargs):
        role = self.validated_data.pop("role", None)
        password = self.validated_data.pop("password", None)
        if role:
            admin = role == "admin"
            kwargs.update(is_superuser=admin, is_staff=admin)
        user = super().save(**kwargs)
        if password:
            user.set_password(password)
            user.save(update_fields=["password"])
        return user


def access(user):
    """"Admin", or what an editor may change: "Editor: menú y página de inicio"."""
    if user.is_superuser:
        return "Admin"
    parts = [label for flag, label in ((user.can_edit_menu, "menú"), (user.can_edit_landing, "página de inicio")) if flag]
    return "Editor: " + " y ".join(parts)


class UserViewSet(viewsets.ModelViewSet):
    # Accounts with no access at all (Django Admin leftovers) stay out of the list.
    queryset = User.objects.filter(Q(is_superuser=True) | Q(can_edit_menu=True) | Q(can_edit_landing=True)).order_by("-is_superuser", "email")
    serializer_class = UserSerializer
    permission_classes = [IsAdmin]

    def perform_create(self, serializer):
        user = serializer.save()
        Activity.record(self.request, f"Añadió a {user.email} ({access(user)})")

    def perform_update(self, serializer):
        before = access(serializer.instance), serializer.instance.is_active, serializer.instance.first_name
        user = serializer.save()
        changes = []
        if access(user) != before[0]:
            changes.append(f"ahora es {access(user)}")
        if user.is_active != before[1]:
            changes.append("activó su cuenta" if user.is_active else "desactivó su cuenta")
        if "password" in self.request.data:
            changes.append("cambió su contraseña")
        if user.first_name != before[2]:
            changes.append(f"nombre: {user.first_name or '(vacío)'}")
        if changes:
            Activity.record(self.request, f"{user.email}: {', '.join(changes)}")

    def perform_destroy(self, user):
        if user == self.request.user:
            raise ValidationError("No puedes eliminar tu propia cuenta.")
        Activity.record(self.request, f"Eliminó a {user.email}")
        user.delete()


@api_view(["GET"])
@permission_classes([IsAdmin])
def activity(request):
    """The last 30 days, newest first (older entries are cleared as new ones come in)."""
    return Response([{"at": a.at, "email": a.email, "text": a.text} for a in Activity.objects.filter(at__gte=timezone.now() - KEEP_ACTIVITY)[:500]])
