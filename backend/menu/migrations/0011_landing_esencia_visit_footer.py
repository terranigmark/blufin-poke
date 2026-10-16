from django.db import migrations

UNSPLASH = "https://images.unsplash.com/photo-{}?w={}&auto=format&fit=crop&q=70"

# The home page's last sections and the footer as they were (src/data/landing.ts has the same copy).
CONTENT = {
    "esencia": {
        "title": "Nuestra esencia es Baja",
        "title_en": "Baja is who we are",
        "lead": "Pesca local, poke hecho al momento y cerveza de Black Marlin, nuestra cervecería. Así de simple.",
        "lead_en": "Local fish, poke made to order and beer from Black Marlin, our own brewery. Simple as that.",
        "image_a": UNSPLASH.format("1546069901-ba9599a7e63c", 900),
        "image_b": UNSPLASH.format("1535958636474-b021ee887b13", 700),
        "cta": "Conoce nuestras cervezas",
        "cta_en": "Meet our beers",
    },
    "visit": {
        "title": "Ven a vernos",
        "title_en": "Come see us",
        "address": "Belisario Domínguez 1251, CP 23000\nLa Paz, Baja California Sur",
        "hours": "Martes a domingo · 13:30 – 21:30\nLunes cerrado",
        "hours_en": "Tuesday to Sunday · 1:30 – 9:30 pm\nClosed Mondays",
        "cta": "Cómo llegar",
        "cta_en": "Get directions",
        "email": "hola@blufinpokeco.com",
    },
    "footer": {
        "brand": "Blufin",
        "tagline": "Poke Co · Black Marlin Brewing",
        "tagline_en": "",
        "city": "La Paz, Baja California Sur",
        "copyright": "© 2026 Blufin Poke Co. Todos los derechos reservados.",
        "copyright_en": "© 2026 Blufin Poke Co. All rights reserved.",
        "social": [
            {"network": "instagram", "url": "https://instagram.com/"},
            {"network": "facebook", "url": "https://facebook.com/"},
            {"network": "tiktok", "url": "https://tiktok.com/"},
        ],
        "email": "hola@blufinpokeco.com",
    },
}


def seed(apps, schema_editor):
    landing, _ = apps.get_model("menu", "Landing").objects.get_or_create(pk=1)
    # Only what nobody has saved yet.
    landing.content = {**CONTENT, **landing.content}
    landing.save()


class Migration(migrations.Migration):
    dependencies = [("menu", "0010_merge_landing_and_categories")]

    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
