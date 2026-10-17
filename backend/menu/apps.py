from django.apps import AppConfig
from django.db.models.signals import post_delete, post_save


def clear_public_menu(sender, **kwargs):
    if sender._meta.app_label == "menu":
        from django.core.cache import cache

        from .api import PUBLIC_MENU_KEY

        cache.delete(PUBLIC_MENU_KEY)


class MenuConfig(AppConfig):
    name = "menu"
    verbose_name = "Menú"

    def ready(self):
        # Every save goes through .save()/.delete() (editor, Django Admin, seeds), so the cached public menu never outlives an edit.
        post_save.connect(clear_public_menu)
        post_delete.connect(clear_public_menu)
