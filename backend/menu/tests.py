from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase, override_settings

from .models import Beer, Drink, Ingredient, Size

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
    def setUp(self):
        cache.clear()  # the login throttle counts in the cache, which outlives each test

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

    def test_public_menu_has_english_names_with_spanish_fallback(self):
        data = self.client.get("/api/menu/").json()
        tuna = next(i for i in data["ingredients"] if i["key"] == "atun")
        self.assertEqual((tuna["name"], tuna["name_en"]), ("Atún", "Tuna"))
        # Same in both languages: left empty, the website shows the Spanish name.
        tofu = next(i for i in data["ingredients"] if i["key"] == "tofu")
        self.assertEqual(tofu["name_en"], "")
        stout = next(b for b in data["beers"] if b["tap"] == "01")
        self.assertEqual(stout["description_en"], "Roasted coffee, bitter cocoa and a silky body.")
        self.assertTrue(all(d["name_en"] for d in data["drinks"] if d["category"] == "aguas" and d["name"].startswith("Agua")))

    def test_editor_saves_english_name(self):
        User.objects.create_user("mesera@blufin.mx", PASSWORD, can_edit_menu=True)
        size = Size.objects.get(key="small")
        response = self.client.patch(
            f"/api/editor/sizes/{size.pk}/",
            {"name_en": "Small bowl"},
            content_type="application/json",
            **self.auth("mesera@blufin.mx"),
        )
        self.assertEqual(response.status_code, 200)
        size.refresh_from_db()
        self.assertEqual(size.name_en, "Small bowl")

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

    def test_anonymous_cannot_write(self):
        size = Size.objects.first()
        self.assertEqual(self.client.patch(f"/api/editor/sizes/{size.pk}/", {"price": 1}, content_type="application/json").status_code, 401)
        self.assertEqual(self.client.delete(f"/api/editor/sizes/{size.pk}/").status_code, 401)
        self.assertEqual(self.client.post("/api/menu/", {}).status_code, 405)
        self.assertNotEqual(Size.objects.get(pk=size.pk).price, 1)

    def test_editor_sees_hidden_items_the_public_does_not(self):
        User.objects.create_user("mesera@blufin.mx", PASSWORD, can_edit_menu=True)
        Drink.objects.filter(name="Kombucha").update(available=False)
        names = lambda data: {d["name"] for d in data["drinks"]}
        self.assertNotIn("Kombucha", names(self.client.get("/api/menu/").json()))
        self.assertIn("Kombucha", names(self.client.get("/api/editor/", **self.auth("mesera@blufin.mx")).json()))

    def test_invalid_data_is_refused(self):
        User.objects.create_user("mesera@blufin.mx", PASSWORD, can_edit_menu=True)
        h = self.auth("mesera@blufin.mx")
        size = Size.objects.first()
        r = self.client.patch(f"/api/editor/sizes/{size.pk}/", {"price": "mucho"}, content_type="application/json", **h)
        self.assertEqual(r.status_code, 400)
        self.assertIn("price", r.json())
        r = self.client.post("/api/editor/ingredients/", {"step": "nope", "name": "X"}, content_type="application/json", **h)
        self.assertEqual(r.status_code, 400)

    def test_refresh_token_gives_a_new_access_token(self):
        User.objects.create_user("mesera@blufin.mx", PASSWORD, can_edit_menu=True)
        refresh = self.token("mesera@blufin.mx").json()["refresh"]
        r = self.client.post("/api/auth/refresh/", {"refresh": refresh})
        self.assertEqual(r.status_code, 200)
        h = {"HTTP_AUTHORIZATION": "Bearer " + r.json()["access"]}
        self.assertEqual(self.client.get("/api/editor/", **h).status_code, 200)
        self.assertEqual(self.client.post("/api/auth/refresh/", {"refresh": "basura"}).status_code, 401)

    def test_login_is_throttled(self):
        codes = [self.token("nadie@blufin.mx").status_code for _ in range(11)]
        self.assertEqual(codes[:10], [401] * 10)
        self.assertEqual(codes[10], 429)
