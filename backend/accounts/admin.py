from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.forms import AdminUserCreationForm, UserChangeForm

from .models import User


class UserCreationForm(AdminUserCreationForm):
    class Meta(AdminUserCreationForm.Meta):
        model = User
        fields = ("email",)


class UserEditForm(UserChangeForm):
    class Meta(UserChangeForm.Meta):
        model = User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    # The stock UserAdmin is built around `username`; these swap it for `email`.
    add_form = UserCreationForm
    form = UserEditForm
    ordering = ("email",)
    list_display = ("email", "first_name", "last_name", "can_edit_menu", "is_staff", "is_active")
    list_filter = ("can_edit_menu", "is_staff", "is_superuser", "is_active")
    search_fields = ("email", "first_name", "last_name")
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Datos personales", {"fields": ("first_name", "last_name")}),
        ("Acceso", {"fields": ("is_active", "can_edit_menu", "is_staff", "is_superuser", "groups", "user_permissions")}),
        ("Fechas", {"fields": ("last_login", "date_joined")}),
    )
    add_fieldsets = (
        (None, {"classes": ("wide",), "fields": ("email", "usable_password", "password1", "password2", "can_edit_menu")}),
    )
