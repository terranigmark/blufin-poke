from datetime import timedelta
from importlib import import_module

from django.apps import apps
from django.core.cache import cache
from django.test import TestCase
from django.utils import timezone

from menu.models import Size

from .models import Activity, User

PASSWORD = "una-clave-larga-123"
NEW_PASSWORD = "otra-clave-larga-456"


class UsersApiTests(TestCase):
    def setUp(self):
        cache.clear()  # the login throttle counts in the cache
        self.admin = User.objects.create_superuser("ruth@blufin.mx", PASSWORD)
        self.editor = User.objects.create_user("mesera@blufin.mx", PASSWORD, can_edit_menu=True)

    def auth(self, email, password=PASSWORD):
        response = self.client.post("/api/auth/login/", {"email": email, "password": password})
        return {"HTTP_AUTHORIZATION": "Bearer " + response.json()["access"]}

    def call(self, method, url, data=None, who="ruth@blufin.mx"):
        return getattr(self.client, method)(url, data, content_type="application/json", **self.auth(who))

    def test_admin_lists_users_and_editor_menu_says_which_tabs(self):
        User.objects.create_user("sin-acceso@blufin.mx", PASSWORD)
        rows = self.call("get", "/api/editor/users/").json()
        self.assertEqual(
            [(u["email"], u["role"], u["menu"], u["landing"]) for u in rows],
            [("ruth@blufin.mx", "admin", True, True), ("mesera@blufin.mx", "editor", True, False)],
        )
        self.assertNotIn("password", rows[0])
        me = lambda who: self.call("get", "/api/editor/", who=who).json()["me"]
        self.assertEqual(me("ruth@blufin.mx"), {"email": "ruth@blufin.mx", "admin": True, "menu": True, "landing": True})
        self.assertEqual(me("mesera@blufin.mx"), {"email": "mesera@blufin.mx", "admin": False, "menu": True, "landing": False})

    def test_editors_and_anonymous_cannot_manage_users_or_read_the_log(self):
        self.assertEqual(self.call("get", "/api/editor/users/", who="mesera@blufin.mx").status_code, 403)
        self.assertEqual(self.call("post", "/api/editor/users/", {"email": "x@blufin.mx", "password": NEW_PASSWORD}, who="mesera@blufin.mx").status_code, 403)
        self.assertEqual(self.call("delete", f"/api/editor/users/{self.admin.pk}/", who="mesera@blufin.mx").status_code, 403)
        self.assertEqual(self.call("get", "/api/editor/activity/", who="mesera@blufin.mx").status_code, 403)
        self.assertEqual(self.client.get("/api/editor/users/").status_code, 401)

    def test_admin_adds_an_editor_who_signs_in_with_the_temporary_password(self):
        response = self.call("post", "/api/editor/users/", {"email": " Cocina@Blufin.mx ", "name": "Ana", "password": PASSWORD, "landing": False})
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual((response.json()["email"], response.json()["role"]), ("cocina@blufin.mx", "editor"))
        user = User.objects.get(email="cocina@blufin.mx")
        self.assertTrue(user.can_edit_menu and not user.can_edit_landing and not user.is_staff and not user.is_superuser)
        self.assertEqual(self.call("get", "/api/editor/users/", who="cocina@blufin.mx").status_code, 403)
        self.assertEqual(self.call("get", "/api/editor/", who="cocina@blufin.mx").status_code, 200)

    def test_new_users_need_a_strong_password_a_new_email_and_something_to_change(self):
        self.assertIn("password", self.call("post", "/api/editor/users/", {"email": "a@blufin.mx"}).json())
        self.assertIn("password", self.call("post", "/api/editor/users/", {"email": "a@blufin.mx", "password": "123"}).json())
        self.assertIn("email", self.call("post", "/api/editor/users/", {"email": "mesera@blufin.mx", "password": NEW_PASSWORD}).json())
        response = self.call("post", "/api/editor/users/", {"email": "a@blufin.mx", "password": NEW_PASSWORD, "menu": False, "landing": False})
        self.assertEqual(response.status_code, 400)
        self.assertIn("al menos una", str(response.json()))

    def test_permissions_decide_what_an_editor_can_change(self):
        url = f"/api/editor/users/{self.editor.pk}/"
        size = Size.objects.first()
        # Menu only: the home page is closed.
        self.assertEqual(self.call("patch", "/api/editor/landing/", {"belt": {"words": []}}, who="mesera@blufin.mx").status_code, 403)
        self.assertEqual(self.call("post", "/api/editor/media/", {"file": ""}, who="mesera@blufin.mx").status_code, 403)
        # Swapped to the home page only: now the menu is closed and the home page open.
        self.assertEqual(self.call("patch", url, {"menu": False, "landing": True}).json()["landing"], True)
        self.assertEqual(self.call("patch", f"/api/editor/sizes/{size.pk}/", {"price": 1}, who="mesera@blufin.mx").status_code, 403)
        self.assertEqual(self.call("patch", "/api/editor/landing/", {"belt": {"words": []}}, who="mesera@blufin.mx").status_code, 200)
        self.assertEqual(self.call("get", "/api/editor/", who="mesera@blufin.mx").status_code, 200)
        self.assertEqual(self.call("patch", url, {"landing": False}).status_code, 400)

    def test_admin_promotes_resets_disables_and_deletes(self):
        url = f"/api/editor/users/{self.editor.pk}/"
        self.assertEqual(self.call("patch", url, {"role": "admin"}).json()["role"], "admin")
        self.editor.refresh_from_db()
        self.assertTrue(self.editor.is_superuser and self.editor.is_staff)

        self.call("patch", url, {"password": NEW_PASSWORD})
        self.assertEqual(self.client.post("/api/auth/login/", {"email": "mesera@blufin.mx", "password": PASSWORD}).status_code, 401)
        headers = self.auth("mesera@blufin.mx", NEW_PASSWORD)

        self.assertFalse(self.call("patch", url, {"role": "editor", "active": False}).json()["active"])
        # Disabled: the token she already has stops working at once.
        self.assertEqual(self.client.get("/api/editor/", **headers).status_code, 401)

        self.assertEqual(self.call("delete", url).status_code, 204)
        self.assertFalse(User.objects.filter(pk=self.editor.pk).exists())

    def test_admin_cannot_lock_themselves_out(self):
        url = f"/api/editor/users/{self.admin.pk}/"
        self.assertEqual(self.call("patch", url, {"role": "editor"}).status_code, 400)
        self.assertEqual(self.call("patch", url, {"active": False}).status_code, 400)
        self.assertEqual(self.call("delete", url).status_code, 400)
        self.admin.refresh_from_db()
        self.assertTrue(self.admin.is_superuser and self.admin.is_active)
        # Changing their own name or password is fine.
        self.assertEqual(self.call("patch", url, {"name": "Ruth"}).status_code, 200)

    def test_menu_editors_keep_home_page_access_after_the_migration(self):
        migration = import_module("accounts.migrations.0002_landing_access_and_activity")
        User.objects.filter(pk=self.editor.pk).update(can_edit_landing=False)
        migration.keep_landing_access(apps, None)
        self.editor.refresh_from_db()
        self.assertTrue(self.editor.can_edit_landing)


class ActivityTests(TestCase):
    def setUp(self):
        cache.clear()
        User.objects.create_superuser("ruth@blufin.mx", PASSWORD)
        User.objects.create_user("mesera@blufin.mx", PASSWORD, can_edit_menu=True, can_edit_landing=True)

    def call(self, method, url, data=None, who="mesera@blufin.mx"):
        token = self.client.post("/api/auth/login/", {"email": who, "password": PASSWORD}).json()["access"]
        return getattr(self.client, method)(url, data, content_type="application/json", HTTP_AUTHORIZATION="Bearer " + token)

    def log(self):
        return [(a["email"], a["text"]) for a in self.call("get", "/api/editor/activity/", who="ruth@blufin.mx").json()]

    def test_records_who_changed_what_newest_first(self):
        size = Size.objects.get(key="regular")
        self.call("patch", f"/api/editor/sizes/{size.pk}/", {"price": 250, "available": False})
        bowl = self.call("post", "/api/editor/bowls/", {"name": "Clásico", "price": 200, "order": 0}).json()
        self.call("delete", f"/api/editor/bowls/{bowl['id']}/")
        self.call("patch", "/api/editor/landing/", {"belt": {"words": []}})
        self.call("post", "/api/editor/users/", {"email": "cocina@blufin.mx", "password": NEW_PASSWORD, "landing": False}, who="ruth@blufin.mx")
        self.assertEqual(
            self.log(),
            [
                ("ruth@blufin.mx", "Añadió a cocina@blufin.mx (Editor: menú)"),
                ("mesera@blufin.mx", "Cambió la página de inicio: Franja animada"),
                ("mesera@blufin.mx", "Eliminó bowl de la casa “Clásico”"),
                ("mesera@blufin.mx", "Añadió bowl de la casa “Clásico”"),
                ("mesera@blufin.mx", "Cambió tamaño de bowl “Regular”: disponible: sí → no; precio (MXN): 235 → 250"),
            ],
        )

    def test_saving_without_changes_records_nothing(self):
        size = Size.objects.get(key="regular")
        self.call("patch", f"/api/editor/sizes/{size.pk}/", {"price": size.price})
        self.assertEqual(self.log(), [])

    def test_keeps_30_days(self):
        user = User.objects.get(email="mesera@blufin.mx")
        old = Activity.objects.create(user=user, email=user.email, text="Hace mucho")
        Activity.objects.filter(pk=old.pk).update(at=timezone.now() - timedelta(days=31))
        self.assertEqual(self.log(), [])  # not shown, even before anything clears it
        size = Size.objects.get(key="regular")
        self.call("patch", f"/api/editor/sizes/{size.pk}/", {"price": 240})
        self.assertFalse(Activity.objects.filter(pk=old.pk).exists())
        # Deleting the account keeps who did it.
        user.delete()
        self.assertEqual(self.log()[0][0], "mesera@blufin.mx")
