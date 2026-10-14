from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models


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
