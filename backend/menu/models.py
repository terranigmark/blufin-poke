"""Everything the public menu shows, mirroring src/data/menu.ts in the frontend.

`key` fields keep the frontend's ids: orders encoded in QR links refer to items
by them, so they must not change once an item is live.
"""

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


class MenuItem(models.Model):
    name = models.CharField("nombre", max_length=100)
    # Optional: the website shows `name` in English too when this is empty.
    name_en = models.CharField("nombre en inglés", max_length=100, blank=True)
    STATUSES = [
        ("", "Disponible"),
        ("agotado", "Agotado"),
        ("proximamente", "Próximamente"),
        ("por_agotarse", "Por agotarse"),
        ("novedad", "Novedad"),
    ]

    # `available` decides whether the item is on the menu at all; `status` is the badge it shows there.
    available = models.BooleanField("disponible", default=True)
    status = models.CharField("estado", max_length=12, choices=STATUSES, blank=True, default="")
    order = models.PositiveIntegerField("orden", default=0)

    class Meta:
        abstract = True
        ordering = ("order", "id")

    def __str__(self):
        return self.name


class Size(MenuItem):
    key = models.SlugField("clave", unique=True)
    price = models.PositiveIntegerField("precio (MXN)")

    class Meta(MenuItem.Meta):
        verbose_name = "tamaño de bowl"
        verbose_name_plural = "tamaños de bowl"


class Ingredient(MenuItem):
    STEPS = [
        ("base", "Base"),
        ("protein", "Proteína"),
        ("mix", "Mix-ins"),
        ("salsa", "Salsa"),
        ("top", "Toppings"),
        ("crunch", "Crunchies"),
    ]

    step = models.CharField("paso", max_length=10, choices=STEPS)
    key = models.SlugField("clave")
    image_url = models.URLField("foto (URL)", blank=True)

    class Meta(MenuItem.Meta):
        verbose_name = "ingrediente"
        verbose_name_plural = "ingredientes"
        ordering = ("step", "order", "id")
        constraints = [models.UniqueConstraint(fields=("step", "key"), name="unique_ingredient_step_key")]


class Extra(MenuItem):
    price = models.PositiveIntegerField("precio (MXN)")
    in_builder = models.BooleanField(
        "en Arma tu poke", default=False, help_text="Se ofrece en la pantalla final de Arma tu poke."
    )
    key = models.SlugField("clave", blank=True, help_text="Solo para los extras de Arma tu poke.")

    class Meta(MenuItem.Meta):
        verbose_name = "extra"
        verbose_name_plural = "extras"


class HouseBowl(MenuItem):
    """A ready-made bowl. The first three on the menu show on the home page as "Bowls de la casa"."""

    price = models.PositiveIntegerField("precio (MXN)")
    description = models.CharField("descripción", max_length=200, blank=True)
    description_en = models.CharField("descripción en inglés", max_length=200, blank=True)
    image_url = models.URLField("foto (URL)", blank=True)

    class Meta(MenuItem.Meta):
        verbose_name = "bowl de la casa"
        verbose_name_plural = "bowls de la casa"


class Beer(MenuItem):
    tap = models.CharField("grifo", max_length=4, unique=True)
    style = models.CharField("estilo", max_length=60)
    abv = models.CharField("ABV", max_length=10, help_text="Ej. 5.2%")
    price_12 = models.PositiveIntegerField("precio 12 oz (MXN)")
    price_16 = models.PositiveIntegerField("precio 16 oz (MXN)")
    color = models.CharField("color", max_length=7, default="#E8B84A", help_text="Hex, ej. #E8B84A")
    description = models.CharField("descripción", max_length=200, blank=True)
    description_en = models.CharField("descripción en inglés", max_length=200, blank=True)

    class Meta(MenuItem.Meta):
        verbose_name = "cerveza de barril"
        verbose_name_plural = "cervezas de barril"
        ordering = ("tap",)


class Drink(MenuItem):
    PACKS = [("Botella", "Botella"), ("Lata", "Lata")]

    # The key of a "drinks" Category: aguas, nacional, or a list the manager added.
    category = models.CharField("categoría", max_length=50)
    price = models.PositiveIntegerField("precio (MXN)")
    size = models.CharField("tamaño", max_length=20, help_text="Ej. 355 ml")
    pack = models.CharField("envase", max_length=10, choices=PACKS)

    class Meta(MenuItem.Meta):
        verbose_name = "bebida"
        verbose_name_plural = "bebidas"
        ordering = ("category", "order", "id")


class Category(models.Model):
    """A section of the menu, as in Cervesoft's categories card.

    Every section has one, so the editor can rename, reorder and hide it. Only
    price lists (`kind="drinks"`) can be added or deleted; the rest are built in,
    because Arma tu poke and the beer list depend on them. `key` is the
    Ingredient step for builder steps, and Drink.category for price lists.
    """

    KINDS = [
        ("sizes", "Tamaños de bowl"),
        ("ingredients", "Paso de Arma tu poke"),
        ("extras", "Extras"),
        ("beers", "Cerveza de barril"),
        ("drinks", "Lista de precios"),
    ]

    key = models.SlugField("clave", max_length=50, unique=True)
    kind = models.CharField("tipo", max_length=12, choices=KINDS, default="drinks")
    name = models.CharField("nombre", max_length=60)
    name_en = models.CharField("nombre en inglés", max_length=60, blank=True)
    # Hidden lists leave the public menu and the TV; Arma tu poke's sections can't be hidden.
    available = models.BooleanField("visible", default=True)
    order = models.PositiveIntegerField("orden", default=0)
    builtin = models.BooleanField("de fábrica", default=False, editable=False)

    class Meta:
        ordering = ("order", "id")
        verbose_name = "categoría"
        verbose_name_plural = "categorías"

    def __str__(self):
        return self.name

    @property
    def in_builder(self):
        return self.kind in ("sizes", "ingredients")


class Settings(models.Model):
    """Display settings, as in Cervesoft's settings card: one row, created on first read."""

    tv_seconds = models.PositiveSmallIntegerField(
        "segundos por pantalla en la TV", default=10, validators=[MinValueValidator(4), MaxValueValidator(60)]
    )
    tv_poke_right = models.BooleanField("poke a la derecha en la TV", default=False)
    tv_text_scale = models.FloatField(
        "tamaño del texto en la TV", default=1, validators=[MinValueValidator(0.8), MaxValueValidator(1.3)]
    )
    menu_text_scale = models.FloatField(
        "tamaño del texto en el menú", default=1, validators=[MinValueValidator(0.85), MaxValueValidator(1.3)]
    )
    highlight_seconds = models.PositiveSmallIntegerField(
        "segundos por destacado", default=8, validators=[MinValueValidator(3), MaxValueValidator(60)]
    )

    class Meta:
        verbose_name = verbose_name_plural = "ajustes"

    @classmethod
    def get(cls):
        return cls.objects.get_or_create(pk=1)[0]


class Highlight(models.Model):
    """A promo image for the menu's carousel and the TV, as in Cervesoft's highlights card.

    Either an uploaded picture (stored here: Koyeb's disk doesn't survive a deploy)
    or a link to one hosted elsewhere.
    """

    image = models.BinaryField("imagen", blank=True)
    content_type = models.CharField(max_length=20, blank=True)
    url = models.URLField("enlace a la imagen", blank=True)
    order = models.PositiveIntegerField("orden", default=0)

    class Meta:
        ordering = ("order", "id")
        verbose_name = "destacado"
        verbose_name_plural = "destacados"


class Landing(models.Model):
    """The home page's editable content: one row, a JSON object per section ("header", "hero", "belt").

    Texts come in pairs, `x` in Spanish and `x_en` in English (empty shows the Spanish).
    Pictures and videos are links: uploads (`/api/media/<id>/`), site files (`/video/…`) or https.
    The shape of each section is checked by its serializer in api.py.
    """

    content = models.JSONField("contenido", default=dict)

    class Meta:
        verbose_name = verbose_name_plural = "página de inicio"

    @classmethod
    def get(cls):
        return cls.objects.get_or_create(pk=1)[0]


class Media(models.Model):
    """A picture or video uploaded for the home page, stored here like highlights (Koyeb's disk doesn't survive a deploy)."""

    data = models.BinaryField()
    content_type = models.CharField(max_length=20)
    created = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "archivo"
        verbose_name_plural = "archivos"

    @property
    def src(self):
        return f"/api/media/{self.pk}/"
