from django.db import migrations

UNSPLASH = "https://images.unsplash.com/photo-{}?w={}&auto=format&fit=crop&q=70"

# The home page's Arma tu poke and ¿Qué se te antoja? sections as they were (src/data/landing.ts has the same copy).
CONTENT = {
    "build": {
        "title": "Arma tu poke",
        "title_en": "Build your poke",
        "lead": "Seis pasos y tú decides todo. Lo armamos al momento.",
        "lead_en": "Six steps and you call the shots. We make it fresh to order.",
        "steps": [
            {"text": "Elige tu base", "text_en": "Choose your base"},
            {"text": "Elige tu proteína", "text_en": "Choose your protein"},
            {"text": "Elige tus mix-ins", "text_en": "Choose your mix-ins"},
            {"text": "Elige tu salsa", "text_en": "Choose your sauce"},
            {"text": "Elige tus toppings", "text_en": "Choose your toppings"},
            {"text": "Crunchies", "text_en": ""},
        ],
        "cta": "Empezar mi bowl",
        "cta_en": "Start my bowl",
        "image": UNSPLASH.format("1604259597308-5321e8e4789c", 1200),
    },
    "cravings": {
        "title": "¿Qué se te antoja?",
        "title_en": "What are you craving?",
        "tiles": [
            {"image": UNSPLASH.format("1623428187969-5da2dcea5ebf", 700), "text": "Extras", "text_en": "", "link": "/menu?tab=extras"},
            {"image": UNSPLASH.format("1436076863939-06870fe779c2", 700), "text": "Bebidas", "text_en": "Drinks", "link": "/menu?tab=aguas"},
            {"image": UNSPLASH.format("1535958636474-b021ee887b13", 700), "text": "Cerveza craft", "text_en": "Craft beer", "link": "/menu?tab=beer"},
        ],
    },
}


def seed(apps, schema_editor):
    landing, _ = apps.get_model("menu", "Landing").objects.get_or_create(pk=1)
    # Only what nobody has saved yet.
    landing.content = {**CONTENT, **landing.content}
    landing.save()


class Migration(migrations.Migration):
    dependencies = [("menu", "0007_landing")]

    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
