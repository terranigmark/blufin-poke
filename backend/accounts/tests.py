from django.core.cache import cache
from django.test import TestCase

from .models import User

PASSWORD = "una-clave-larga-123"
NEW_PASSWORD = "otra-clave-larga-456"


class UsersApiTests(TestCase):
    def setUp(self):
        cache.clear()  # the login throttle counts in the cache
        self.owner = User.objects.create_superuser("ruth@blufin.mx", PASSWORD)
        self.editor = User.objects.create_user("mesera@blufin.mx", PASSWORD, can_edit_menu=True)

    def auth(self, email, password=PASSWORD):
        response = self.client.post("/api/auth/login/", {"email": email, "password": password})
        return {"HTTP_AUTHORIZATION": "Bearer " + response.json()["access"]}

    def call(self, method, url, data=None, who="ruth@blufin.mx"):
        return getattr(self.client, method)(url, data, content_type="application/json", **self.auth(who))

    def test_owner_lists_users_and_editor_menu_says_who_is_owner(self):
        User.objects.create_user("sin-acceso@blufin.mx", PASSWORD)
        rows = self.call("get", "/api/editor/users/").json()
        self.assertEqual([(u["email"], u["role"], u["active"]) for u in rows], [("ruth@blufin.mx", "owner", True), ("mesera@blufin.mx", "editor", True)])
        self.assertNotIn("password", rows[0])
        self.assertEqual(self.call("get", "/api/editor/").json()["me"], {"email": "ruth@blufin.mx", "owner": True})
        self.assertFalse(self.call("get", "/api/editor/", who="mesera@blufin.mx").json()["me"]["owner"])

    def test_editors_and_anonymous_cannot_manage_users(self):
        self.assertEqual(self.call("get", "/api/editor/users/", who="mesera@blufin.mx").status_code, 403)
        self.assertEqual(self.call("post", "/api/editor/users/", {"email": "x@blufin.mx", "password": NEW_PASSWORD}, who="mesera@blufin.mx").status_code, 403)
        self.assertEqual(self.call("delete", f"/api/editor/users/{self.owner.pk}/", who="mesera@blufin.mx").status_code, 403)
        self.assertEqual(self.client.get("/api/editor/users/").status_code, 401)

    def test_owner_adds_an_editor_who_signs_in_with_the_temporary_password(self):
        response = self.call("post", "/api/editor/users/", {"email": " Cocina@Blufin.mx ", "name": "Ana", "password": PASSWORD})
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual((response.json()["email"], response.json()["role"]), ("cocina@blufin.mx", "editor"))
        user = User.objects.get(email="cocina@blufin.mx")
        self.assertTrue(user.can_edit_menu and not user.is_staff and not user.is_superuser)
        self.assertEqual(self.call("get", "/api/editor/users/", who="cocina@blufin.mx").status_code, 403)
        self.assertEqual(self.call("get", "/api/editor/", who="cocina@blufin.mx").status_code, 200)

    def test_new_users_need_a_strong_password_and_a_new_email(self):
        self.assertIn("password", self.call("post", "/api/editor/users/", {"email": "a@blufin.mx"}).json())
        self.assertIn("password", self.call("post", "/api/editor/users/", {"email": "a@blufin.mx", "password": "123"}).json())
        self.assertIn("email", self.call("post", "/api/editor/users/", {"email": "mesera@blufin.mx", "password": NEW_PASSWORD}).json())

    def test_owner_promotes_resets_disables_and_deletes(self):
        url = f"/api/editor/users/{self.editor.pk}/"
        self.assertEqual(self.call("patch", url, {"role": "owner"}).json()["role"], "owner")
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

    def test_owner_cannot_lock_themselves_out(self):
        url = f"/api/editor/users/{self.owner.pk}/"
        self.assertEqual(self.call("patch", url, {"role": "editor"}).status_code, 400)
        self.assertEqual(self.call("patch", url, {"active": False}).status_code, 400)
        self.assertEqual(self.call("delete", url).status_code, 400)
        self.owner.refresh_from_db()
        self.assertTrue(self.owner.is_superuser and self.owner.is_active)
        # Changing their own name or password is fine.
        self.assertEqual(self.call("patch", url, {"name": "Ruth"}).status_code, 200)
