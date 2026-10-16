from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase, override_settings

import base64
from importlib import import_module

from .models import Beer, Category, Drink, Highlight, HouseBowl, Ingredient, Landing, Media, Size

nearest_srm = import_module("menu.migrations.0008_beer_srm").nearest_srm

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
        # Totopos reads "Nachos" as a base and "Tortilla chips" as a crunchy, as on the printed menu.
        totopos = {i["step"]: i["name_en"] for i in data["ingredients"] if i["key"] == "totopos"}
        self.assertEqual(totopos, {"base": "Nachos", "crunch": "Tortilla chips"})
        stout = next(b for b in data["beers"] if b["tap"] == "01")
        self.assertEqual(stout["description_en"], "Roasted coffee, bitter cocoa and a silky body.")
        self.assertTrue(all(d["name_en"] for d in data["drinks"] if d["category"] == "aguas" and d["name"].startswith("Agua")))

    def test_editor_adds_house_bowls_and_the_public_menu_lists_visible_ones(self):
        User.objects.create_user("mesera@blufin.mx", PASSWORD, can_edit_menu=True)
        self.assertEqual(self.client.get("/api/menu/").json()["bowls"], [])
        response = self.client.post(
            "/api/editor/bowls/",
            {"name": "Clásico", "name_en": "Classic", "price": 215, "description": "Atún, aguacate y ponzu", "order": 0},
            content_type="application/json",
            **self.auth("mesera@blufin.mx"),
        )
        self.assertEqual(response.status_code, 201)
        HouseBowl.objects.create(name="Oculto", price=200, available=False, order=1)
        bowls = self.client.get("/api/menu/").json()["bowls"]
        self.assertEqual([(b["name"], b["name_en"], b["price"]) for b in bowls], [("Clásico", "Classic", 215)])
        self.assertEqual(len(self.client.get("/api/editor/", **self.auth("mesera@blufin.mx")).json()["bowls"]), 2)

    def test_only_editors_add_house_bowls(self):
        response = self.client.post("/api/editor/bowls/", {"name": "X", "price": 1}, content_type="application/json")
        self.assertIn(response.status_code, (401, 403))
        self.assertFalse(HouseBowl.objects.exists())

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

    def test_status_is_saved_and_shown_on_the_public_menu(self):
        User.objects.create_user("mesera@blufin.mx", PASSWORD, can_edit_menu=True)
        h = self.auth("mesera@blufin.mx")
        beer = Beer.objects.get(tap="01")
        r = self.client.patch(f"/api/editor/beers/{beer.pk}/", {"status": "agotado"}, content_type="application/json", **h)
        self.assertEqual(r.status_code, 200)
        # Sold out stays on the menu with its badge; only `available=False` takes it off.
        stout = next(b for b in self.client.get("/api/menu/").json()["beers"] if b["tap"] == "01")
        self.assertEqual(stout["status"], "agotado")
        r = self.client.patch(f"/api/editor/beers/{beer.pk}/", {"status": "otra"}, content_type="application/json", **h)
        self.assertEqual(r.status_code, 400)

    def test_duplicating_a_beer_needs_its_own_tap(self):
        User.objects.create_user("mesera@blufin.mx", PASSWORD, can_edit_menu=True)
        h = self.auth("mesera@blufin.mx")
        copy = {k: v for k, v in self.client.get("/api/editor/", **h).json()["beers"][0].items() if k != "id"}
        r = self.client.post("/api/editor/beers/", copy, content_type="application/json", **h)
        self.assertEqual(r.status_code, 400)
        self.assertIn("tap", r.json())
        r = self.client.post("/api/editor/beers/", {**copy, "tap": "99", "name": "Copia"}, content_type="application/json", **h)
        self.assertEqual(r.status_code, 201, r.content)

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

    def test_beer_colours_are_on_the_srm_scale(self):
        # Migration 0008 turned the old hex colours into the nearest SRM value.
        srm = dict(Beer.objects.values_list("name", "srm"))
        self.assertEqual((srm["American Stout"], srm["Hazy Baby IPA"], srm["American Lager"]), (40, 4, 2))
        self.assertEqual(nearest_srm("#36080A"), 40)
        self.assertEqual(nearest_srm("#fff"), 1)
        self.assertEqual(nearest_srm("no es color"), 4)

        User.objects.create_user("mesera@blufin.mx", PASSWORD, can_edit_menu=True)
        h = self.auth("mesera@blufin.mx")
        beer = Beer.objects.get(tap="01")
        url = f"/api/editor/beers/{beer.pk}/"
        self.assertEqual(self.client.patch(url, {"srm": 12}, content_type="application/json", **h).json()["srm"], 12)
        for bad in (0, 41):
            r = self.client.patch(url, {"srm": bad}, content_type="application/json", **h)
            self.assertEqual(r.status_code, 400)
            self.assertIn("srm", r.json())

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



class PageSettingsTests(TestCase):
    """Cervesoft's settings, highlights and categories cards, as the website and the editor see them."""

    def setUp(self):
        cache.clear()
        User.objects.create_user("mesera@blufin.mx", PASSWORD, can_edit_menu=True)
        token = self.client.post("/api/auth/login/", {"email": "mesera@blufin.mx", "password": PASSWORD}).json()["access"]
        self.h = {"HTTP_AUTHORIZATION": "Bearer " + token}

    def call(self, method, url, data=None):
        return getattr(self.client, method)(url, data, content_type="application/json", **self.h)

    def test_built_in_sections_come_seeded_in_the_editors_order(self):
        cats = self.client.get("/api/menu/").json()["categories"]
        self.assertEqual(
            [c["key"] for c in cats],
            ["sizes", "base", "protein", "mix", "salsa", "top", "crunch", "extras", "beers", "aguas", "nacional"],
        )
        self.assertTrue(all(c["builtin"] for c in cats))

    def test_a_new_price_list_takes_drinks_and_deleting_it_takes_them_too(self):
        r = self.call("post", "/api/editor/categories/", {"name": "Cócteles", "name_en": "Cocktails", "order": 11, "kind": "beers"})
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual((r.json()["key"], r.json()["kind"], r.json()["builtin"]), ("cocteles", "drinks", False))
        cat = r.json()["id"]
        r = self.call("post", "/api/editor/drinks/", {"category": "cocteles", "name": "Mezcalita", "price": 120, "size": "300 ml", "pack": "Botella"})
        self.assertEqual(r.status_code, 201, r.content)
        # Drinks only go into price lists that exist.
        r = self.call("post", "/api/editor/drinks/", {"category": "beers", "name": "X", "price": 1, "size": "1", "pack": "Lata"})
        self.assertIn("category", r.json())

        self.assertEqual(self.call("delete", f"/api/editor/categories/{cat}/").status_code, 204)
        self.assertFalse(Drink.objects.filter(category="cocteles").exists())

    def test_sections_belong_to_poke_drinks_or_others(self):
        groups = {c["key"]: c["group"] for c in self.client.get("/api/menu/").json()["categories"]}
        self.assertEqual({k for k, g in groups.items() if g == "poke"}, {"sizes", "base", "protein", "mix", "salsa", "top", "crunch", "extras"})
        self.assertEqual({k for k, g in groups.items() if g == "drinks"}, {"beers", "aguas", "nacional"})

        # A new list goes in Bebidas or Otros, and its items need no bottle or can.
        r = self.call("post", "/api/editor/categories/", {"name": "Postres", "group": "others"})
        self.assertEqual((r.status_code, r.json()["group"]), (201, "others"))
        r = self.call("post", "/api/editor/drinks/", {"category": "postres", "name": "Brownie", "price": 60, "size": "", "pack": ""})
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(self.call("post", "/api/editor/categories/", {"name": "X", "group": "poke"}).status_code, 400)
        aguas = Category.objects.get(key="aguas")
        self.assertEqual(self.call("patch", f"/api/editor/categories/{aguas.pk}/", {"group": "others"}).json()["group"], "others")
        # Arma tu poke's sections and the beer list stay in their group.
        base, beers = Category.objects.get(key="base"), Category.objects.get(key="beers")
        self.assertEqual(self.call("patch", f"/api/editor/categories/{base.pk}/", {"group": "drinks"}).status_code, 400)
        self.assertEqual(self.call("patch", f"/api/editor/categories/{beers.pk}/", {"group": "others"}).status_code, 400)
        self.assertEqual(self.call("patch", f"/api/editor/categories/{beers.pk}/", {"group": "drinks", "name": "Black Marlin"}).status_code, 200)

    def test_built_in_sections_rename_and_reorder_but_never_go_away(self):
        base = Category.objects.get(key="base")
        r = self.call("patch", f"/api/editor/categories/{base.pk}/", {"name": "Bases", "order": 3, "key": "otra"})
        self.assertEqual(r.status_code, 200)
        base.refresh_from_db()
        self.assertEqual((base.name, base.order, base.key), ("Bases", 3, "base"))
        # Arma tu poke needs its sections; the beer list can be hidden.
        self.assertEqual(self.call("patch", f"/api/editor/categories/{base.pk}/", {"available": False}).status_code, 400)
        beers = Category.objects.get(key="beers")
        self.assertEqual(self.call("patch", f"/api/editor/categories/{beers.pk}/", {"available": False}).status_code, 200)
        self.assertEqual(self.call("delete", f"/api/editor/categories/{beers.pk}/").status_code, 400)
        self.assertTrue(Category.objects.filter(key="beers").exists())

    def test_settings_save_within_their_limits(self):
        self.assertEqual(self.client.get("/api/menu/").json()["settings"]["tv_seconds"], 10)
        r = self.call("patch", "/api/editor/settings/", {"tv_seconds": 15, "tv_poke_right": True})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(self.client.get("/api/menu/").json()["settings"]["tv_seconds"], 15)
        self.assertEqual(self.call("patch", "/api/editor/settings/", {"tv_seconds": 1}).status_code, 400)
        self.assertEqual(self.client.patch("/api/editor/settings/", {"tv_seconds": 20}, content_type="application/json").status_code, 401)

    def test_highlights_upload_link_and_serve(self):
        png = base64.b64encode(b"\x89PNG fake bytes").decode()
        r = self.call("post", "/api/editor/highlights/", {"image": f"data:image/png;base64,{png}", "order": 0})
        self.assertEqual(r.status_code, 201, r.content)
        src = r.json()["src"]
        self.assertNotIn("image", r.json())
        img = self.client.get(src)
        self.assertEqual((img.status_code, img["Content-Type"], img.content), (200, "image/png", b"\x89PNG fake bytes"))
        self.assertIn("immutable", img["Cache-Control"])

        r = self.call("post", "/api/editor/highlights/", {"url": "https://example.com/promo.jpg", "order": 1})
        self.assertEqual(r.json()["src"], "https://example.com/promo.jpg")
        self.assertEqual([h["order"] for h in self.client.get("/api/menu/").json()["highlights"]], [0, 1])

        # Refused: nothing, both, http links, non-images and oversized files.
        bad = [
            {},
            {"url": "http://example.com/x.jpg"},
            {"image": "data:text/html;base64,PGI+"},
            {"image": "data:image/png;base64," + base64.b64encode(b"x" * 1_500_001).decode()},
        ]
        for data in bad:
            self.assertEqual(self.call("post", "/api/editor/highlights/", data).status_code, 400, data)
        self.assertEqual(self.client.post("/api/editor/highlights/", {}).status_code, 401)
        self.assertEqual(Highlight.objects.count(), 2)


class LandingTests(TestCase):
    """The home page's cards in /admin: seeded with the old copy, saved per section, uploads served back."""

    def setUp(self):
        cache.clear()
        User.objects.create_user("mesera@blufin.mx", PASSWORD, can_edit_menu=True)
        token = self.client.post("/api/auth/login/", {"email": "mesera@blufin.mx", "password": PASSWORD}).json()["access"]
        self.h = {"HTTP_AUTHORIZATION": "Bearer " + token}

    def call(self, method, url, data=None):
        return getattr(self.client, method)(url, data, content_type="application/json", **self.h)

    def landing(self):
        return self.client.get("/api/menu/").json()["landing"]

    def test_seeded_with_the_home_page_as_it_was(self):
        landing = self.landing()
        self.assertEqual(landing["hero"]["slogan"], "Buena comida, cerveza fría, gente de mar")
        self.assertEqual(landing["hero"]["video"], "/video/hero-waves.mp4")
        self.assertEqual([w["text"] for w in landing["belt"]["words"]], ["Poke", "Baja", "Craft Beer", "Pesca del día", "Black Marlin"])
        self.assertEqual(landing["header"], {"marlin_logo": "", "blufin_logo": ""})

    def test_saving_a_section_replaces_only_that_section(self):
        hero = {**self.landing()["hero"], "slogan": "Nuevo eslogan", "slogan_en": ""}
        r = self.call("patch", "/api/editor/landing/", {"hero": hero})
        self.assertEqual(r.status_code, 200, r.content)
        landing = self.landing()
        self.assertEqual(landing["hero"]["slogan"], "Nuevo eslogan")
        self.assertEqual(len(landing["belt"]["words"]), 5)

        words = [{"text": "Hola"}, {"text": "Mar", "text_en": "Sea"}]
        self.assertEqual(self.call("patch", "/api/editor/landing/", {"belt": {"words": words}}).status_code, 200)
        self.assertEqual(self.landing()["belt"]["words"], [{"text": "Hola", "text_en": ""}, {"text": "Mar", "text_en": "Sea"}])

    def test_bad_sections_are_refused(self):
        hero = self.landing()["hero"]
        bad = [
            {"footer": {}},
            {"hero": {**hero, "image": "javascript:alert(1)"}},
            {"hero": {**hero, "image": "//evil.example/x.jpg"}},
            {"hero": {k: v for k, v in hero.items() if k != "lead"}},
            {"belt": {"words": [{"text": ""}]}},
            {"header": {"marlin_logo": "http://example.com/logo.png", "blufin_logo": ""}},
        ]
        for data in bad:
            self.assertEqual(self.call("patch", "/api/editor/landing/", data).status_code, 400, data)
        self.assertEqual(self.landing()["hero"], hero)
        self.assertEqual(self.client.patch("/api/editor/landing/", {}, content_type="application/json").status_code, 401)

    def test_upload_and_serve_with_ranges(self):
        video = b"0123456789"
        r = self.call("post", "/api/editor/media/", {"file": "data:video/mp4;base64," + base64.b64encode(video).decode()})
        self.assertEqual(r.status_code, 201, r.content)
        src = r.json()["src"]
        whole = self.client.get(src)
        self.assertEqual((whole.status_code, whole["Content-Type"], whole.content), (200, "video/mp4", video))
        self.assertIn("immutable", whole["Cache-Control"])
        part = self.client.get(src, HTTP_RANGE="bytes=2-5")
        self.assertEqual((part.status_code, part.content, part["Content-Range"]), (206, b"2345", "bytes 2-5/10"))
        self.assertEqual(self.client.get(src, HTTP_RANGE="bytes=-3").content, b"789")
        self.assertEqual(self.client.get(src, HTTP_RANGE="bytes=8-").content, b"89")
        self.assertEqual(self.client.get(src, HTTP_RANGE="bytes=20-").status_code, 416)

        # The link goes into a section like any other.
        r = self.call("patch", "/api/editor/landing/", {"header": {"marlin_logo": src, "blufin_logo": ""}})
        self.assertEqual(r.json()["header"]["marlin_logo"], src)

        bad = [
            {},
            {"file": "data:text/html;base64,PGI+"},
            {"file": "data:image/svg+xml;base64,PHN2Zz4="},
            {"file": "data:image/png;base64," + base64.b64encode(b"x" * 1_500_001).decode()},
        ]
        for data in bad:
            self.assertEqual(self.call("post", "/api/editor/media/", data).status_code, 400, data)
        self.assertEqual(self.client.post("/api/editor/media/", {}).status_code, 401)

    def test_saving_clears_old_unused_uploads(self):
        used = Media.objects.create(data=b"a", content_type="image/png")
        stale = Media.objects.create(data=b"b", content_type="image/png")
        fresh = Media.objects.create(data=b"c", content_type="image/png")
        Media.objects.filter(pk__in=[used.pk, stale.pk]).update(created="2020-01-01T00:00Z")
        self.call("patch", "/api/editor/landing/", {"header": {"marlin_logo": used.src, "blufin_logo": ""}})
        self.assertEqual(set(Media.objects.values_list("pk", flat=True)), {used.pk, fresh.pk})
        self.assertEqual(Landing.objects.count(), 1)
