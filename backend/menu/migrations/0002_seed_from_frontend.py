"""Loads the menu the frontend ships today (src/data/menu.ts) so the editor starts full."""

from django.db import migrations

U = "https://images.unsplash.com/photo-{}?w={}&auto=format&fit=crop&q=70"

SIZES = [("small", "Small", 165), ("regular", "Regular", 235)]

# step: [(key, name, unsplash photo id or None)]
INGREDIENTS = {
    "base": [
        ("arroz", "Arroz sushi", "1516684732162-798a0062be99"),
        ("ensalada", "Ensalada", "1540420773420-3366772f4999"),
        ("totopos", "Totopos", "1582169296194-e4d644c48063"),
        ("mitad", "50/50", "1512621776951-a57141f2eefd"),
    ],
    "protein": [
        ("pesca", "Pesca del día", "1534604973900-c43ab4c2e0ab"),
        ("atun", "Atún", "1579584425555-c3ce17fd4351"),
        ("atunspicy", "Atún Spicy", "1617196034183-421b4917c92d"),
        ("camaron", "Camarón", "1565680018434-b513d5e5fd47"),
        ("tofu", "Tofu", "1604908176997-125f25cc6f3d"),
    ],
    "mix": [
        ("cilantro", "Cilantro", None),
        ("cebmorada", "Cebolla morada", "1618512496248-a07fe83aa8cb"),
        ("cebblanca", "Cebolla blanca", "1580201092675-a0a6a6cafbb1"),
        ("cebollin", "Cebollín", None),
        ("jalapeno", "Chile jalapeño", None),
        ("ajonjoli", "Ajonjolí", None),
    ],
    "salsa": [
        ("spicymayo", "Spicy Mayo", None),
        ("shoyu", "Shoyu", None),
        ("citrusponzu", "Citrus Ponzu", "1590502593747-42a996133562"),
        ("gingerponzu", "Ginger Ponzu", None),
        ("teriyaki", "Teriyaki", None),
        ("jalshoyu", "Jalapeño Shoyu", None),
        ("gingergarlic", "Ginger Garlic Evoo", "1540148426945-6cf22a6b2383"),
        ("aceiteajonjoli", "Aceite de Ajonjolí", "1474979266404-7eaacbcd87c5"),
        ("jalmonster", "Jalapeño Monster", None),
    ],
    "top": [
        ("aguacate", "Aguacate", "1519162808019-7de1683fa2ad"),
        ("enscangrejo", "Ensalada de cangrejo", None),
        ("edamame", "Edamames", None),
        ("cherry", "Tomate cherry", "1546094096-0df4bcaaa337"),
        ("zanahoria", "Zanahoria", "1598170845058-32b9d6a5da37"),
        ("wakame", "Alga wakame", None),
        ("col", "Col morada", None),
        ("germinado", "Germinado", None),
        ("pepino", "Pepino", "1449300079323-02e209d9d3a6"),
        ("fruta", "Fruta de temporada", "1619566636858-adf3ef46400b"),
    ],
    "crunch": [
        ("cebcrispy", "Cebolla crispy", "1639024471283-03518883512d"),
        ("hotcheetos", "Hot Cheetos", None),
        ("macadamia", "Nueces de macadamia", None),
        ("totopos", "Totopos", "1513456852971-30c0b8199d4d"),
        ("jengibre", "Jengibre", None),
    ],
}
# The frontend shows photos at 500px on the two photo steps and 300px elsewhere.
PHOTO_WIDTH = {"base": 500, "protein": 500}

# (name, price, builder key or "" when only on the Menú page)
EXTRAS = [
    ("Proteína", 25, "xprot"),
    ("Aguacate", 20, "xagu"),
    ("Wakame", 20, "xwak"),
    ("Toppings", 15, ""),
    ("Crunchies", 10, ""),
    ("Cangrejo", 20, "xcan"),
    ("Salsa", 10, ""),
    ("Arroz / ensalada / totopos", 50, ""),
]

# (tap, name, style, abv, price 12 oz, price 16 oz, color, description)
BEERS = [
    ("01", "American Stout", "Stout", "5.2%", 100, 120, "#2A1810", "Café tostado, cacao amargo y cuerpo sedoso."),
    ("02", "Pastry Porter", "Porter", "6.2%", 70, 90, "#3B2216", "Vainilla, chocolate y un final dulce de postre."),
    ("03", "Hazy Baby IPA", "Hazy IPA", "7.12%", 70, 90, "#E8B84A", "Jugosa y turbia, con notas de mango y durazno."),
    ("04", "Coastal Dream IPA", "IPA", "6.9%", 70, 90, "#D99A2B", "Cítrica y resinosa, como brisa de costa."),
    ("05", "Baby IPA", "Session IPA", "5.4%", 70, 90, "#E0A93A", "Ligera y aromática, para toda la tarde."),
    ("06", "Angry Belga", "Belgian Ale", "4.9%", 70, 90, "#C8822B", "Levadura belga, especiada y frutal."),
    ("07", "American Lager", "Lager", "3.4%", 70, 90, "#F0CF6A", "Limpia y refrescante, hecha para el calor."),
    ("08", "West Coast Mexican Lager", "Lager", "5.4%", 70, 90, "#EBC150", "Crujiente, con lúpulo estilo costa oeste."),
]

# category: [(name, price, size, pack)]
DRINKS = {
    "aguas": [
        ("Agua mineral", 40, "355 ml", "Botella"),
        ("Agua de coco", 40, "330 ml", "Lata"),
        ("Agua natural", 15, "500 ml", "Botella"),
        ("Té gasificado", 60, "355 ml", "Lata"),
        ("Refresco", 40, "355 ml", "Lata"),
        ("Agua de sabor", 40, "500 ml", "Botella"),
        ("Té frío", 40, "500 ml", "Botella"),
        ("Cold brew", 75, "355 ml", "Lata"),
        ("Kombucha", 80, "355 ml", "Botella"),
        ("Soda Orita", 65, "355 ml", "Lata"),
    ],
    "nacional": [
        ("Pacífico", 35, "210 ml", "Botella"),
        ("Coronita", 35, "210 ml", "Botella"),
        ("Modelo", 50, "355 ml", "Lata"),
    ],
}


def seed(apps, schema_editor):
    M = {n: apps.get_model("menu", n) for n in ("Size", "Ingredient", "Extra", "Beer", "Drink")}
    M["Size"].objects.bulk_create(
        M["Size"](key=k, name=n, price=p, order=i) for i, (k, n, p) in enumerate(SIZES)
    )
    M["Ingredient"].objects.bulk_create(
        M["Ingredient"](
            step=step, key=k, name=n, order=i,
            image_url=U.format(photo, PHOTO_WIDTH.get(step, 300)) if photo else "",
        )
        for step, opts in INGREDIENTS.items()
        for i, (k, n, photo) in enumerate(opts)
    )
    M["Extra"].objects.bulk_create(
        M["Extra"](name=n, price=p, key=k, in_builder=bool(k), order=i) for i, (n, p, k) in enumerate(EXTRAS)
    )
    M["Beer"].objects.bulk_create(
        M["Beer"](tap=t, name=n, style=s, abv=a, price_12=p12, price_16=p16, color=c, description=d)
        for t, n, s, a, p12, p16, c, d in BEERS
    )
    M["Drink"].objects.bulk_create(
        M["Drink"](category=cat, name=n, price=p, size=sz, pack=pk, order=i)
        for cat, items in DRINKS.items()
        for i, (n, p, sz, pk) in enumerate(items)
    )


def unseed(apps, schema_editor):
    for n in ("Size", "Ingredient", "Extra", "Beer", "Drink"):
        apps.get_model("menu", n).objects.all().delete()


class Migration(migrations.Migration):
    dependencies = [("menu", "0001_initial")]
    operations = [migrations.RunPython(seed, unseed)]
