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


class MenuApiTests(TestCase):
    def token(self, email):
        response = self.client.post("/api/auth/login/", {"email": email, "password": PASSWORD})
        return response

    def auth(self, email):
        return {"HTTP_AUTHORIZATION": "Bearer " + self.token(email).json()["access"]}

    def test_public_menu_hides_unavailable_items(self):
        Beer.objects.filter(tap="01").update(available=False)
        data = self.client.get("/api/menu/").json()
        self.assertEqual(len(data["beers"]), 7)
        self.assertEqual(len(data["ingredients"]), 39)
        self.assertEqual(data["sizes"][0]["key"], "small")

    def test_only_menu_editors_get_tokens(self):
        User.objects.create_user("otro@blufin.mx", PASSWORD)
        self.assertEqual(self.token("otro@blufin.mx").status_code, 403)
        self.assertEqual(self.token("nadie@blufin.mx").status_code, 401)
        self.assertEqual(self.client.get("/api/editor/").status_code, 401)

    def test_editor_edits_adds_and_deletes(self):
        User.objects.create_user("mesera@blufin.mx", PASSWORD, can_edit_menu=True)
        h = self.auth("mesera@blufin.mx")
        self.assertEqual(len(self.client.get("/api/editor/", **h).json()["drinks"]), 13)

        beer = Beer.objects.get(tap="02")
        r = self.client.patch(
            f"/api/editor/beers/{beer.pk}/", {"price_16": 95}, content_type="application/json", **h
        )
        self.assertEqual(r.status_code, 200)
        self.assertEqual(Beer.objects.get(pk=beer.pk).price_16, 95)

        # A new ingredient gets a key from its name, unique within its step.
        r = self.client.post(
            "/api/editor/ingredients/", {"step": "crunch", "name": "Totopos"}, content_type="application/json", **h
        )
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(r.json()["key"], "totopos-2")

        self.assertEqual(self.client.delete(f"/api/editor/beers/{beer.pk}/", **h).status_code, 204)

    def test_removing_the_flag_locks_out_existing_tokens(self):
        user = User.objects.create_user("mesera@blufin.mx", PASSWORD, can_edit_menu=True)
        h = self.auth("mesera@blufin.mx")
        user.can_edit_menu = False
        user.save()
        self.assertEqual(self.client.get("/api/editor/", **h).status_code, 403)

    def test_website_origin_may_call_the_api(self):
        r = self.client.get("/api/menu/", HTTP_ORIGIN="https://blufinpoke.com")
        self.assertEqual(r["Access-Control-Allow-Origin"], "https://blufinpoke.com")
        r = self.client.get("/api/menu/", HTTP_ORIGIN="https://evil.example")
        self.assertNotIn("Access-Control-Allow-Origin", r)
