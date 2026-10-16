from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import migrations, models

# The standard SRM colours, SRM 1 to 40; the same list as SRM in src/data/menu.ts.
SRM = (
    "#FFE699 #FFD878 #FFCA5A #FFBF42 #FBB123 #F8A600 #F39C00 #EA8F00 #E58500 #DE7C00 "
    "#D77200 #CF6900 #CB6200 #C35900 #BB5100 #B54C00 #B04500 #A63E00 #A13700 #9B3200 "
    "#952D00 #8E2900 #882300 #821E00 #7B1A00 #771900 #701400 #6A0E00 #660D00 #5E0B00 "
    "#5A0A02 #600903 #520907 #4C0505 #470606 #440607 #3F0708 #3B0607 #3A070B #36080A"
).split()


def rgb(hex_color):
    h = hex_color.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    return [int(h[i : i + 2], 16) for i in (0, 2, 4)]


def nearest_srm(hex_color):
    """The SRM value whose colour is closest to `hex_color`; 4 (the old default's) when it isn't a colour."""
    try:
        c = rgb(hex_color)
    except ValueError:
        return 4
    return 1 + min(range(40), key=lambda i: sum((a - b) ** 2 for a, b in zip(rgb(SRM[i]), c)))


def to_srm(apps, schema_editor):
    Beer = apps.get_model("menu", "Beer")
    for beer in Beer.objects.all():
        beer.srm = nearest_srm(beer.color)
        beer.save(update_fields=["srm"])


def to_color(apps, schema_editor):
    Beer = apps.get_model("menu", "Beer")
    for beer in Beer.objects.all():
        beer.color = SRM[beer.srm - 1]
        beer.save(update_fields=["color"])


class Migration(migrations.Migration):

    dependencies = [
        ("menu", "0006_house_bowls"),
    ]

    operations = [
        migrations.AddField(
            model_name="beer",
            name="srm",
            field=models.PositiveSmallIntegerField(
                default=4,
                help_text="1 = muy clara, 40 = negra.",
                validators=[MinValueValidator(1), MaxValueValidator(40)],
                verbose_name="color (SRM)",
            ),
        ),
        migrations.RunPython(to_srm, to_color),
        migrations.RemoveField(model_name="beer", name="color"),
    ]
