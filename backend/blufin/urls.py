from django.contrib import admin
from django.urls import include, path

from rest_framework_simplejwt.views import TokenRefreshView

from menu import api
from menu.admin import menu_site

urlpatterns = [
    # Owners: user accounts and everything else.
    path("admin/", admin.site.urls),
    # Owners and designated employees: the menu only.
    path("menu/", menu_site.urls),
    # The website: public menu, and the editor at blufinpoke.com/login.
    path("api/menu/", api.public_menu),
    path("api/auth/login/", api.LoginView.as_view()),
    path("api/auth/refresh/", TokenRefreshView.as_view()),
    path("api/editor/", api.editor_menu),
    path("api/editor/settings/", api.editor_settings),
    path("api/highlights/<int:pk>/image/", api.highlight_image),
    path("api/editor/landing/", api.editor_landing),
    path("api/editor/media/", api.editor_media),
    path("api/media/<int:pk>/", api.media_file),
    path("api/", include(api.router.urls)),
]
