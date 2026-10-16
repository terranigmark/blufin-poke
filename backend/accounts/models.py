from datetime import timedelta

from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models
from django.utils import timezone


class UserManager(BaseUserManager):
    use_in_migrations = True

    def create_user(self, email, password=None, **extra):
        if not email:
            raise ValueError("El correo es obligatorio.")
        user = self.model(email=self.normalize_email(email), **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra):
        extra.setdefault("is_staff", True)
        extra.setdefault("is_superuser", True)
        return self.create_user(email, password, **extra)


class User(AbstractUser):
    """Signs in with email and password; there is no username."""

    username = None
    email = models.EmailField("correo", unique=True)
    can_edit_menu = models.BooleanField(
        "puede editar el menú",
        default=False,
        help_text="Da acceso al editor del menú en /menu/. Los superusuarios siempre lo tienen.",
    )
    can_edit_landing = models.BooleanField(
        "puede editar la página de inicio",
        default=False,
        help_text="Da acceso a la pestaña Página de inicio en blufinpoke.com/admin. Los superusuarios siempre lo tienen.",
    )

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    objects = UserManager()

    class Meta:
        verbose_name = "usuario"
        verbose_name_plural = "usuarios"

    def __str__(self):
        return self.email

    @property
    def is_menu_editor(self):
        return self.is_active and (self.is_superuser or self.can_edit_menu)

    @property
    def is_landing_editor(self):
        return self.is_active and (self.is_superuser or self.can_edit_landing)

    @property
    def has_editor_access(self):
        """May sign in to blufinpoke.com/admin: can change at least one part of the site."""
        return self.is_menu_editor or self.is_landing_editor


KEEP_ACTIVITY = timedelta(days=30)


class Activity(models.Model):
    """One change made in blufinpoke.com/admin, kept for 30 days for the admins' "Actividad" tab."""

    at = models.DateTimeField("cuándo", auto_now_add=True, db_index=True)
    user = models.ForeignKey(User, models.SET_NULL, null=True, verbose_name="usuario")
    # Kept apart from `user` so the entry still says who after the account is deleted.
    email = models.EmailField("correo")
    text = models.TextField("qué cambió")

    class Meta:
        ordering = ["-at", "-pk"]
        verbose_name = "actividad"
        verbose_name_plural = "actividad"

    @classmethod
    def record(cls, request, text):
        cls.objects.create(user=request.user, email=request.user.email, text=text)
        cls.objects.filter(at__lt=timezone.now() - KEEP_ACTIVITY).delete()
