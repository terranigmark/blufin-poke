from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings

from .models import Beer, Ingredient

User = get_user_model()
PASSWORD = "una-clave-larga-123"


# The manifest storage needs collectstatic; the plain one serves admin CSS straight from the apps.
@override_settings(
    STORAGES={
        "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
        "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
    }
)
class MenuAccessTests(TestCase):
    def login(self, email):
        return self.client.post(
            "/menu/login/?next=/menu/", {"username": email, "password": PASSWORD}, follow=True
        )

    def test_anonymous_is_sent_to_login(self):
        self.assertRedirects(self.client.get("/menu/"), "/menu/login/?next=/menu/")

    def test_menu_editor_signs_in_with_email_and_edits(self):
        User.objects.create_user("mesera@blufin.mx", PASSWORD, can_edit_menu=True)
        self.assertEqual(self.login("mesera@blufin.mx").request["PATH_INFO"], "/menu/")

        beer = Beer.objects.get(tap="01")
        self.assertEqual(self.client.get(f"/menu/menu/beer/{beer.pk}/change/").status_code, 200)
        # Employees are not staff, so the owners' admin stays closed to them.
        self.assertEqual(self.client.get("/admin/").status_code, 302)

    def test_account_without_menu_access_is_refused(self):
        User.objects.create_user("otro@blufin.mx", PASSWORD)
        response = self.login("otro@blufin.mx")
        self.assertContains(response, "no tiene acceso al editor del menú")
        self.assertEqual(self.client.get("/menu/").status_code, 302)

    def test_superuser_needs_no_flag(self):
        User.objects.create_superuser("duena@blufin.mx", PASSWORD)
        self.assertEqual(self.login("duena@blufin.mx").request["PATH_INFO"], "/menu/")
        self.assertEqual(self.client.get("/admin/accounts/user/add/").status_code, 200)

    def test_seed_matches_frontend(self):
        self.assertEqual(Ingredient.objects.count(), 39)
        self.assertEqual(Beer.objects.count(), 8)

    def test_owner_creates_menu_editor_in_django_admin(self):
        User.objects.create_superuser("duena@blufin.mx", PASSWORD)
        self.client.login(email="duena@blufin.mx", password=PASSWORD)
        self.client.post(
            "/admin/accounts/user/add/",
            {
                "email": "cocina@blufin.mx",
                "usable_password": "true",
                "password1": PASSWORD,
                "password2": PASSWORD,
                "can_edit_menu": "on",
            },
        )
        user = User.objects.get(email="cocina@blufin.mx")
        self.assertTrue(user.can_edit_menu and user.check_password(PASSWORD))
        self.assertFalse(user.is_staff)
