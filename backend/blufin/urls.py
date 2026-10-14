from django.contrib import admin
from django.urls import path

from menu.admin import menu_site

urlpatterns = [
    # Owners: user accounts and everything else.
    path("admin/", admin.site.urls),
    # Owners and designated employees: the menu only.
    path("menu/", menu_site.urls),
]
