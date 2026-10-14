"""The menu editor at /menu/: a second admin site with only the menu in it.

Owners and the employees they mark "puede editar el menú" in the Django Admin
sign in here with email and password. Employees don't need (and shouldn't get)
`is_staff`, so they never see /admin/ or the user accounts.
"""

from django.contrib import admin
from django.contrib.auth.forms import AuthenticationForm
from django.core.exceptions import ValidationError

from .models import Beer, Drink, Extra, Ingredient, Size


def is_editor(request):
    # AnonymousUser has no is_menu_editor; the admin asks about it while rendering the login page.
    return getattr(request.user, "is_menu_editor", False)


class MenuLoginForm(AuthenticationForm):
    # Rejected at the form too, or the session would open and bounce back to login with no message.
    def confirm_login_allowed(self, user):
        super().confirm_login_allowed(user)
        if not user.is_menu_editor:
            raise ValidationError(
                "Esta cuenta no tiene acceso al editor del menú.", code="no_menu_access"
            )


class MenuSite(admin.AdminSite):
    site_header = "Blufin Poke Co · Menú"
    site_title = "Menú Blufin"
    index_title = "Editar el menú"
    login_form = MenuLoginForm

    def has_permission(self, request):
        return is_editor(request)


menu_site = MenuSite(name="menu")


class MenuAdmin(admin.ModelAdmin):
    """Full access for menu editors, without needing per-model Django permissions."""

    def has_module_permission(self, request):
        return is_editor(request)

    has_view_permission = has_add_permission = has_change_permission = has_delete_permission = (
        lambda self, request, obj=None: is_editor(request)
    )


@admin.register(Size, site=menu_site)
class SizeAdmin(MenuAdmin):
    list_display = ("name", "price", "available", "order")
    list_editable = ("price", "available", "order")


@admin.register(Ingredient, site=menu_site)
class IngredientAdmin(MenuAdmin):
    list_display = ("name", "step", "available", "order")
    list_editable = ("available", "order")
    list_filter = ("step", "available")
    search_fields = ("name",)


@admin.register(Extra, site=menu_site)
class ExtraAdmin(MenuAdmin):
    list_display = ("name", "price", "in_builder", "available", "order")
    list_editable = ("price", "in_builder", "available", "order")


@admin.register(Beer, site=menu_site)
class BeerAdmin(MenuAdmin):
    list_display = ("tap", "name", "style", "abv", "price_12", "price_16", "available")
    list_display_links = ("tap", "name")
    list_editable = ("price_12", "price_16", "available")


@admin.register(Drink, site=menu_site)
class DrinkAdmin(MenuAdmin):
    list_display = ("name", "category", "size", "pack", "price", "available", "order")
    list_editable = ("price", "available", "order")
    list_filter = ("category", "available")
    search_fields = ("name",)
