from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from django.contrib.auth.models import User
from . import models


@admin.register(models.Profile)
class ProfileAdmin(admin.ModelAdmin):
	list_display = ("user", "role", "phone")
	list_filter = ("role",)
	search_fields = ("user__username", "user__email", "phone")


@admin.register(models.MenuCategory)
class MenuCategoryAdmin(admin.ModelAdmin):
	list_display = ("id", "name")
	search_fields = ("name",)


@admin.register(models.Ingredient)
class IngredientAdmin(admin.ModelAdmin):
	list_display = ("name", "unit", "stock_quantity", "low_stock_threshold", "active")
	list_filter = ("active",)
	search_fields = ("name",)


@admin.register(models.MenuItem)
class MenuItemAdmin(admin.ModelAdmin):
	list_display = ("name", "category", "price", "available", "featured")
	list_filter = ("available", "featured", "category")
	search_fields = ("name", "description")


@admin.register(models.IngredientUsage)
class IngredientUsageAdmin(admin.ModelAdmin):
	list_display = ("menu_item", "ingredient", "quantity_per_unit")
	list_filter = ("ingredient", "menu_item")


@admin.register(models.FoodSet)
class FoodSetAdmin(admin.ModelAdmin):
	list_display = ("name", "price", "active")
	list_filter = ("active",)
	search_fields = ("name",)


@admin.register(models.SetItem)
class SetItemAdmin(admin.ModelAdmin):
	list_display = ("food_set", "menu_item", "quantity")
	list_filter = ("food_set",)


@admin.register(models.Voucher)
class VoucherAdmin(admin.ModelAdmin):
	list_display = ("code", "discount_type", "amount", "min_spend", "max_discount", "active", "used_count", "usage_limit")
	list_filter = ("discount_type", "active")
	search_fields = ("code",)


@admin.register(models.Address)
class AddressAdmin(admin.ModelAdmin):
	list_display = ("user", "line1", "city", "postcode", "is_default")
	list_filter = ("is_default",)
	search_fields = ("line1", "city", "postcode", "user__username")


class OrderItemInline(admin.TabularInline):
	model = models.OrderItem
	extra = 0


@admin.register(models.Order)
class OrderAdmin(admin.ModelAdmin):
	list_display = ("id", "user", "order_type", "status", "subtotal", "discount_amount", "delivery_fee", "total", "created_at")
	list_filter = ("order_type", "status", "created_at")
	search_fields = ("id", "user__username")
	inlines = [OrderItemInline]


@admin.register(models.OrderItem)
class OrderItemAdmin(admin.ModelAdmin):
	list_display = ("order", "menu_item", "food_set", "quantity", "unit_price", "total_price")
	list_filter = ("menu_item", "food_set")


@admin.register(models.Payment)
class PaymentAdmin(admin.ModelAdmin):
	list_display = ("order", "method", "amount", "status", "paid_at")
	list_filter = ("method", "status")


@admin.register(models.RiderAssignment)
class RiderAssignmentAdmin(admin.ModelAdmin):
	list_display = ("order", "rider", "status", "accepted_at", "picked_at", "delivered_at")
	list_filter = ("status",)
	search_fields = ("order__id", "rider__username")


@admin.register(models.InventoryTransaction)
class InventoryTransactionAdmin(admin.ModelAdmin):
	list_display = ("ingredient", "type", "change_qty", "order", "created_at")
	list_filter = ("type", "ingredient")
	search_fields = ("ingredient__name",)


# Attach Profile inline to Django's built-in User admin for full CRUD from one place
class ProfileInline(admin.StackedInline):
	model = models.Profile
	can_delete = False
	fk_name = 'user'
	extra = 0


class UserAdmin(DjangoUserAdmin):
	inlines = (ProfileInline,)
	list_display = tuple(DjangoUserAdmin.list_display) + ("email",)
	search_fields = tuple(DjangoUserAdmin.search_fields) + ("email",)


# Re-register User with our custom admin
try:
	admin.site.unregister(User)
except admin.sites.NotRegistered:
	pass
admin.site.register(User, UserAdmin)

