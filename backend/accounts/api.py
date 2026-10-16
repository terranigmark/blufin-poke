"""The "Usuarios" tab in /admin: owners add, edit and remove the people who update the site.

Two roles, kept in the fields that already exist: an owner is a superuser (users, the
editor and Django Admin), an editor has `can_edit_menu` (the editor only).
"""

from django.contrib.auth.password_validation import validate_password
from django.db.models import Q
from rest_framework import permissions, serializers, viewsets
from rest_framework.exceptions import ValidationError

from .models import User


class IsOwner(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_active and request.user.is_superuser


class UserSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source="first_name", max_length=150, required=False, allow_blank=True)
    role = serializers.ChoiceField(choices=["owner", "editor"], default="editor", write_only=True)
    active = serializers.BooleanField(source="is_active", default=True)
    # Write only: the temporary password for a new user, or a reset.
    password = serializers.CharField(write_only=True, required=False, trim_whitespace=False)

    class Meta:
        model = User
        fields = ["id", "email", "name", "role", "active", "password", "last_login"]
        read_only_fields = ["last_login"]

    def to_representation(self, user):
        data = super().to_representation(user)
        data["role"] = "owner" if user.is_superuser else "editor"
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
        # The signed-in owner is always an active owner, so this also keeps one owner on the site.
        if self.instance == me and (attrs.get("role", "owner") != "owner" or not attrs.get("is_active", True)):
            raise ValidationError("No puedes quitarte el acceso de dueño ni desactivar tu propia cuenta.")
        return attrs

    def save(self, **kwargs):
        role = self.validated_data.pop("role", None)
        password = self.validated_data.pop("password", None)
        if role:
            owner = role == "owner"
            kwargs.update(is_superuser=owner, is_staff=owner, can_edit_menu=True)
        user = super().save(**kwargs)
        if password:
            user.set_password(password)
            user.save(update_fields=["password"])
        return user


class UserViewSet(viewsets.ModelViewSet):
    # Accounts with no access at all (Django Admin leftovers) stay out of the list.
    queryset = User.objects.filter(Q(is_superuser=True) | Q(can_edit_menu=True)).order_by("-is_superuser", "email")
    serializer_class = UserSerializer
    permission_classes = [IsOwner]

    def perform_destroy(self, user):
        if user == self.request.user:
            raise ValidationError("No puedes eliminar tu propia cuenta.")
        user.delete()
