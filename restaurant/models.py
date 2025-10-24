from django.conf import settings
from django.db import models
from django.utils import timezone
from django.core.validators import MinValueValidator
from decimal import Decimal


class Profile(models.Model):
	ROLE_CHOICES = [
		('customer', 'Customer'),
		('staff', 'Staff'),
		('chef', 'Chef'),
		('rider', 'Rider'),
		('admin', 'Admin'),
	]

	user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='profile')
	role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='customer')
	phone = models.CharField(max_length=20, blank=True, default='')

	def __str__(self):
		return f"{self.user.username} ({self.role})"


class Ingredient(models.Model):
	name = models.CharField(max_length=120, unique=True)
	unit = models.CharField(max_length=32, default='kg')
	stock_quantity = models.FloatField(default=0.0, validators=[MinValueValidator(0.0)])
	low_stock_threshold = models.FloatField(default=0.0, validators=[MinValueValidator(0.0)])
	active = models.BooleanField(default=True)

	def __str__(self):
		return f"{self.name} ({self.stock_quantity} {self.unit})"


class MenuCategory(models.Model):
	name = models.CharField(max_length=64, unique=True)

	def __str__(self):
		return self.name


class MenuItem(models.Model):
	name = models.CharField(max_length=160)
	category = models.ForeignKey(MenuCategory, on_delete=models.SET_NULL, null=True, blank=True)
	price = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(0)])
	description = models.TextField(blank=True, default='')
	image_url = models.URLField(blank=True, default='')
	available = models.BooleanField(default=True)
	featured = models.BooleanField(default=False)
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)

	def __str__(self):
		return f"{self.name} - {self.price}"


class IngredientUsage(models.Model):
	menu_item = models.ForeignKey(MenuItem, on_delete=models.CASCADE, related_name='ingredients_usage')
	ingredient = models.ForeignKey(Ingredient, on_delete=models.CASCADE)
	quantity_per_unit = models.FloatField(default=0.0, validators=[MinValueValidator(0.0)])

	class Meta:
		unique_together = ('menu_item', 'ingredient')

	def __str__(self):
		return f"{self.menu_item.name} uses {self.quantity_per_unit} {self.ingredient.unit} of {self.ingredient.name}"


class FoodSet(models.Model):
	name = models.CharField(max_length=160)
	price = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(0)])
	active = models.BooleanField(default=True)
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)

	def __str__(self):
		return f"Set: {self.name} - {self.price}"


class SetItem(models.Model):
	food_set = models.ForeignKey(FoodSet, on_delete=models.CASCADE, related_name='items')
	menu_item = models.ForeignKey(MenuItem, on_delete=models.CASCADE)
	quantity = models.PositiveIntegerField(default=1, validators=[MinValueValidator(1)])

	class Meta:
		unique_together = ('food_set', 'menu_item')

	def __str__(self):
		return f"{self.food_set.name} x {self.menu_item.name} ({self.quantity})"


class Voucher(models.Model):
	DISCOUNT_PERCENT = 'percent'
	DISCOUNT_FIXED = 'fixed'
	DISCOUNT_FREE_SHIP = 'free_ship'
	DISCOUNT_TYPES = [
		(DISCOUNT_PERCENT, 'Percent'),
		(DISCOUNT_FIXED, 'Fixed'),
		(DISCOUNT_FREE_SHIP, 'Free Shipping'),
	]

	code = models.CharField(max_length=32, unique=True)
	discount_type = models.CharField(max_length=16, choices=DISCOUNT_TYPES, default=DISCOUNT_PERCENT)
	amount = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
	min_spend = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
	max_discount = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
	start_at = models.DateTimeField(null=True, blank=True)
	end_at = models.DateTimeField(null=True, blank=True)
	usage_limit = models.PositiveIntegerField(default=0)  # 0 = unlimited
	used_count = models.PositiveIntegerField(default=0)
	active = models.BooleanField(default=True)

	def __str__(self):
		return self.code


class Address(models.Model):
	user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='addresses')
	line1 = models.CharField(max_length=200)
	line2 = models.CharField(max_length=200, blank=True, default='')
	city = models.CharField(max_length=100, blank=True, default='')
	postcode = models.CharField(max_length=20, blank=True, default='')
	lat = models.FloatField(null=True, blank=True)
	lng = models.FloatField(null=True, blank=True)
	is_default = models.BooleanField(default=False)

	def __str__(self):
		return f"{self.line1} {self.city}"


class Order(models.Model):
	TYPE_DINEIN = 'dine-in'
	TYPE_DELIVERY = 'delivery'
	TYPE_TAKEAWAY = 'takeaway'
	ORDER_TYPES = [
		(TYPE_DINEIN, 'Dine-in'),
		(TYPE_DELIVERY, 'Delivery'),
		(TYPE_TAKEAWAY, 'Takeaway'),
	]

	STATUS_PENDING = 'pending'
	STATUS_PREPARING = 'preparing'
	STATUS_READY = 'ready'
	STATUS_DELIVERING = 'delivering'
	STATUS_WAITING_PAYMENT = 'waiting_payment'
	STATUS_PAID = 'paid'
	STATUS_COMPLETED = 'completed'
	STATUS_CANCELLED = 'cancelled'
	STATUS_CHOICES = [
		(STATUS_PENDING, 'Pending'),
		(STATUS_PREPARING, 'Preparing'),
		(STATUS_READY, 'Ready'),
		(STATUS_DELIVERING, 'Delivering'),
		(STATUS_WAITING_PAYMENT, 'Waiting Payment'),
		(STATUS_PAID, 'Paid'),
		(STATUS_COMPLETED, 'Completed'),
		(STATUS_CANCELLED, 'Cancelled'),
	]

	user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='orders')
	order_type = models.CharField(max_length=16, choices=ORDER_TYPES)
	table_number = models.CharField(max_length=16, blank=True, default='')
	address_text = models.CharField(max_length=255, blank=True, default='')
	lat = models.FloatField(null=True, blank=True)
	lng = models.FloatField(null=True, blank=True)
	subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
	delivery_fee = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
	discount_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
	total = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
	status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
	voucher = models.ForeignKey(Voucher, on_delete=models.SET_NULL, null=True, blank=True)
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)

	def __str__(self):
		return f"Order #{self.pk} ({self.order_type}) - {self.status}"


class OrderItem(models.Model):
	order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
	menu_item = models.ForeignKey(MenuItem, on_delete=models.SET_NULL, null=True, blank=True)
	food_set = models.ForeignKey(FoodSet, on_delete=models.SET_NULL, null=True, blank=True)
	quantity = models.PositiveIntegerField(default=1, validators=[MinValueValidator(1)])
	unit_price = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
	total_price = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
	note = models.CharField(max_length=255, blank=True, default='')

	def __str__(self):
		return f"Item {self.menu_item or self.food_set} x{self.quantity}"


class Payment(models.Model):
	METHOD_CASH = 'cash'
	METHOD_QR = 'qr'
	METHOD_CARD = 'card'
	METHODS = [
		(METHOD_CASH, 'Cash'),
		(METHOD_QR, 'QR'),
		(METHOD_CARD, 'Card'),
	]

	order = models.OneToOneField(Order, on_delete=models.CASCADE, related_name='payment')
	method = models.CharField(max_length=16, choices=METHODS, default=METHOD_CASH)
	amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
	paid_at = models.DateTimeField(null=True, blank=True)
	status = models.CharField(max_length=20, default='unpaid')

	def __str__(self):
		oid = getattr(getattr(self, 'order', None), 'pk', '?')
		return f"Payment for Order #{oid} - {self.status}"


class RiderAssignment(models.Model):
	order = models.OneToOneField(Order, on_delete=models.CASCADE, related_name='rider_assignment')
	rider = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='deliveries')
	accepted_at = models.DateTimeField(null=True, blank=True)
	picked_at = models.DateTimeField(null=True, blank=True)
	delivered_at = models.DateTimeField(null=True, blank=True)
	status = models.CharField(max_length=20, default='available')  # available, accepted, delivering, completed

	def __str__(self):
		oid = getattr(getattr(self, 'order', None), 'pk', '?')
		return f"RiderAssignment for Order #{oid} - {self.status}"


class InventoryTransaction(models.Model):
	TYPE_IN = 'in'
	TYPE_OUT = 'out'
	TYPES = [
		(TYPE_IN, 'Stock In'),
		(TYPE_OUT, 'Stock Out'),
	]
	ingredient = models.ForeignKey(Ingredient, on_delete=models.CASCADE, related_name='transactions')
	order = models.ForeignKey(Order, on_delete=models.SET_NULL, null=True, blank=True, related_name='inventory_transactions')
	change_qty = models.FloatField()
	type = models.CharField(max_length=8, choices=TYPES)
	reason = models.CharField(max_length=255, blank=True, default='')
	created_at = models.DateTimeField(auto_now_add=True)

	def __str__(self):
		return f"{self.type} {self.change_qty} of {self.ingredient.name}"


