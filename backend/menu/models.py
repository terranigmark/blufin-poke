"""Everything the public menu shows, mirroring src/data/menu.ts in the frontend.

`key` fields keep the frontend's ids: orders encoded in QR links refer to items
by them, so they must not change once an item is live.
"""

from django.db import models


class MenuItem(models.Model):
    name = models.CharField("nombre", max_length=100)
    # Optional: the website shows `name` in English too when this is empty.
    name_en = models.CharField("nombre en inglés", max_length=100, blank=True)
    available = models.BooleanField("disponible", default=True)
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
    CATEGORIES = [("aguas", "Aguas y refrescos"), ("nacional", "Cerveza nacional")]
    PACKS = [("Botella", "Botella"), ("Lata", "Lata")]

    category = models.CharField("categoría", max_length=10, choices=CATEGORIES)
    price = models.PositiveIntegerField("precio (MXN)")
    size = models.CharField("tamaño", max_length=20, help_text="Ej. 355 ml")
    pack = models.CharField("envase", max_length=10, choices=PACKS)

    class Meta(MenuItem.Meta):
        verbose_name = "bebida"
        verbose_name_plural = "bebidas"
        ordering = ("category", "order", "id")
