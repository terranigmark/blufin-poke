from django.db import migrations, models


def set_groups(apps, schema_editor):
    # Bowl sizes, Arma tu poke's steps and extras are poke elements; beers and price lists are drinks.
    apps.get_model("menu", "Category").objects.filter(kind__in=("sizes", "ingredients", "extras")).update(group="poke")


class Migration(migrations.Migration):

    dependencies = [
        ("menu", "0008_beer_srm"),
    ]

    operations = [
        migrations.AddField(
            model_name="category",
            name="group",
            field=models.CharField(
                choices=[("poke", "Elementos del poke"), ("drinks", "Bebidas"), ("others", "Otros")],
                default="drinks",
                max_length=10,
                verbose_name="grupo",
            ),
        ),
        migrations.RunPython(set_groups, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="drink",
            name="size",
            field=models.CharField(blank=True, help_text="Ej. 355 ml", max_length=20, verbose_name="tamaño"),
        ),
        migrations.AlterField(
            model_name="drink",
            name="pack",
            field=models.CharField(
                blank=True, choices=[("Botella", "Botella"), ("Lata", "Lata")], max_length=10, verbose_name="envase"
            ),
        ),
    ]
