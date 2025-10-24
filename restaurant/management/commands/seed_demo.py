from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.utils import timezone
from decimal import Decimal

from restaurant.models import (
    Profile,
    Ingredient,
    MenuCategory,
    MenuItem,
    IngredientUsage,
    FoodSet,
    SetItem,
    Voucher,
)


class Command(BaseCommand):
    help = "Seed minimal demo data if core tables are empty (idempotent)."

    def handle(self, *args, **options):
        created_any = False

        # Ensure demo users for roles
        for role in ["customer", "staff", "chef", "rider", "admin"]:
            username = f"demo_{role}"
            user, u_created = User.objects.get_or_create(
                username=username,
                defaults={
                    "email": f"{username}@example.com",
                    "first_name": role.capitalize(),
                    "last_name": "Demo",
                },
            )
            prof, p_created = Profile.objects.get_or_create(user=user, defaults={"role": role})
            if p_created:
                self.stdout.write(self.style.SUCCESS(f"Created profile for {username} ({role})"))
                created_any = True

        # Categories
        if MenuCategory.objects.count() == 0:
            cat_pop = MenuCategory.objects.create(name="Popular")
            cat_food = MenuCategory.objects.create(name="Food")
            cat_drk = MenuCategory.objects.create(name="Drinks")
            self.stdout.write(self.style.SUCCESS("Created default categories"))
            created_any = True
        else:
            cat_pop = MenuCategory.objects.filter(name__iexact="Popular").first() or MenuCategory.objects.first()
            cat_food = MenuCategory.objects.filter(name__iexact="Food").first() or MenuCategory.objects.first()
            cat_drk = MenuCategory.objects.filter(name__iexact="Drinks").first() or MenuCategory.objects.first()

        # Ingredients
        if Ingredient.objects.count() == 0:
            rice = Ingredient.objects.create(name="Rice", unit="kg", stock_quantity=10, low_stock_threshold=2)
            chicken = Ingredient.objects.create(name="Chicken", unit="kg", stock_quantity=5, low_stock_threshold=1)
            tea = Ingredient.objects.create(name="Tea", unit="L", stock_quantity=8, low_stock_threshold=2)
            self.stdout.write(self.style.SUCCESS("Created sample ingredients"))
            created_any = True
        else:
            rice = Ingredient.objects.filter(name__iexact="Rice").first() or Ingredient.objects.first()
            chicken = Ingredient.objects.filter(name__iexact="Chicken").first() or Ingredient.objects.first()
            tea = Ingredient.objects.filter(name__iexact="Tea").first() or Ingredient.objects.first()

        # Menu items
        if MenuItem.objects.count() == 0:
            krapao = MenuItem.objects.create(
                name="Basil Chicken Rice",
                category=cat_food,
                price=Decimal("65.00"),
                description="Spicy basil chicken with rice",
                image_url="",
                available=True,
                featured=True,
            )
            milk_tea = MenuItem.objects.create(
                name="Milk Tea",
                category=cat_drk,
                price=Decimal("35.00"),
                description="Sweet milk tea",
                image_url="",
                available=True,
                featured=True,
            )
            IngredientUsage.objects.create(menu_item=krapao, ingredient=rice, quantity_per_unit=0.2)
            IngredientUsage.objects.create(menu_item=krapao, ingredient=chicken, quantity_per_unit=0.25)
            IngredientUsage.objects.create(menu_item=milk_tea, ingredient=tea, quantity_per_unit=0.3)
            self.stdout.write(self.style.SUCCESS("Created sample menu items with ingredient usage"))
            created_any = True

        # Sets
        if FoodSet.objects.count() == 0:
            set_lunch = FoodSet.objects.create(name="Lunch Set", price=Decimal("89.00"), active=True)
            m1 = MenuItem.objects.first()
            if m1:
                SetItem.objects.create(food_set=set_lunch, menu_item=m1, quantity=1)
            self.stdout.write(self.style.SUCCESS("Created a sample food set"))
            created_any = True

        # Vouchers
        if Voucher.objects.count() == 0:
            Voucher.objects.create(
                code="WELCOME10",
                discount_type=Voucher.DISCOUNT_PERCENT,
                amount=Decimal("10"),
                min_spend=Decimal("100.00"),
                max_discount=Decimal("50.00"),
                start_at=timezone.now(),
                end_at=None,
                usage_limit=0,
                active=True,
            )
            self.stdout.write(self.style.SUCCESS("Created sample voucher WELCOME10"))
            created_any = True

        if not created_any:
            self.stdout.write(self.style.WARNING("Nothing to seed; data already present."))
        else:
            self.stdout.write(self.style.SUCCESS("Seeding completed."))
