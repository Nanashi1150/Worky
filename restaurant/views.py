from django.shortcuts import render, redirect
from django.contrib.auth import authenticate, login, logout as dj_logout
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.http import JsonResponse, HttpResponseBadRequest, HttpResponseForbidden
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_POST
from decimal import Decimal
from .models import Profile, Order, OrderItem, Voucher, Payment, RiderAssignment
from django.utils import timezone


def home(request):
	"""
	Landing page with login and full app; no initial role enforced.
	"""
	return render(request, 'restaurant/home.html', {
		'initial_role': None,
		'page_title': 'ระบบจัดการร้านอาหาร'
	})


def login_page(request):
	"""Dedicated login landing page shown first on refresh."""
	if request.method == 'POST':
		identifier = request.POST.get('loginEmail', '').strip()
		password = request.POST.get('loginPassword', '')
		role = request.POST.get('loginRole', 'customer')

		user = None
		if '@' in identifier:
			try:
				user = User.objects.get(email__iexact=identifier)
			except User.DoesNotExist:
				user = None
		elif identifier.isdigit():
			# Lookup by phone on profile
			try:
				profile = Profile.objects.select_related('user').get(phone=identifier)
				user = profile.user
			except Profile.DoesNotExist:
				user = None
		else:
			try:
				user = User.objects.get(username__iexact=identifier)
			except User.DoesNotExist:
				user = None

		if user is not None:
			auth_user = authenticate(request, username=user.username, password=password)
		else:
			auth_user = None

		if auth_user is not None:
			login(request, auth_user)
			# Ensure profile exists and optionally update role to selected (only if none yet)
			profile, created = Profile.objects.get_or_create(user=auth_user)
			if created and role:
				profile.role = role
				profile.save()
			# Redirect by profile role
			target_role = profile.role if profile else 'customer'
			return redirect(f'/{target_role}/')
		else:
			return render(request, 'restaurant/login.html', {
				'page_title': 'เข้าสู่ระบบ',
				'login_error': 'บัญชีหรือรหัสผ่านไม่ถูกต้อง',
			})
	# GET
	return render(request, 'restaurant/login.html', {
		'page_title': 'เข้าสู่ระบบ'
	})


def login_role(request, role: str):
	"""Login page pre-selected for a specific role via /login/<role>/."""
	allowed = {'customer', 'staff', 'chef', 'rider', 'admin'}
	preselect = role if role in allowed else 'customer'
	return render(request, 'restaurant/login.html', {
		'page_title': 'เข้าสู่ระบบ',
		'preselect_role': preselect,
	})

def login_demo(request, role: str):
	"""Quick-login to a demo account per role. Creates the user/profile if missing, then logs in."""
	allowed = {'customer', 'staff', 'chef', 'rider', 'admin'}
	if role not in allowed:
		return redirect('login')
	username = f"demo_{role}"
	email = f"{username}@example.com"
	user, created = User.objects.get_or_create(username=username, defaults={
		'email': email,
		'first_name': role.capitalize(),
		'last_name': 'Demo',
	})
	# Ensure profile role
	profile, _ = Profile.objects.get_or_create(user=user, defaults={'role': role})
	if profile.role != role:
		profile.role = role
		profile.save(update_fields=['role'])
	# Directly log the user in using the default auth backend
	login(request, user, backend='django.contrib.auth.backends.ModelBackend')
	return redirect(f'/{role}/')

def register(request):
	if request.method == 'POST':
		username = request.POST.get('registerUsername', '').strip()
		email = request.POST.get('registerEmail', '').strip()
		phone = request.POST.get('registerPhone', '').strip()
		password = request.POST.get('registerPassword', '')
		confirm = request.POST.get('registerConfirmPassword', '')
		role = request.POST.get('loginRole', 'customer')
		first_name = request.POST.get('registerFirstName', '').strip()
		last_name = request.POST.get('registerLastName', '').strip()

		if not username or not password or password != confirm:
			return render(request, 'restaurant/login.html', {
				'page_title': 'สมัครสมาชิก',
				'register_error': 'ข้อมูลไม่ครบถ้วนหรือรหัสผ่านไม่ตรงกัน',
			})
		if User.objects.filter(username__iexact=username).exists():
			return render(request, 'restaurant/login.html', {
				'page_title': 'สมัครสมาชิก',
				'register_error': 'Username นี้ถูกใช้แล้ว',
			})

		user = User.objects.create_user(username=username, email=email, password=password, first_name=first_name, last_name=last_name)
		profile = Profile.objects.create(user=user, role=role, phone=phone or None)
		login(request, user)
		return redirect(f'/{profile.role}/')
	# GET fallback to login page
	return redirect('login')


@login_required(login_url='/login/')
def customer(request):
	profile = getattr(request.user, 'profile', None)
	if profile and profile.role != 'customer':
		return redirect(f'/{profile.role}/')
	return render(request, 'restaurant/home.html', {
		'initial_role': 'customer',
		'page_title': 'ลูกค้า - ระบบจัดการร้านอาหาร',
		'current_user': request.user,
		'current_role': 'customer',
	})


@login_required(login_url='/login/')
def staff(request):
	profile = getattr(request.user, 'profile', None)
	if profile and profile.role != 'staff':
		return redirect(f'/{profile.role}/')
	return render(request, 'restaurant/home.html', {
		'initial_role': 'staff',
		'page_title': 'พนักงาน - ระบบจัดการร้านอาหาร',
		'current_user': request.user,
		'current_role': 'staff',
	})


@login_required(login_url='/login/')
def chef(request):
	profile = getattr(request.user, 'profile', None)
	if profile and profile.role != 'chef':
		return redirect(f'/{profile.role}/')
	return render(request, 'restaurant/home.html', {
		'initial_role': 'chef',
		'page_title': 'เชฟ - ระบบจัดการร้านอาหาร',
		'current_user': request.user,
		'current_role': 'chef',
	})


@login_required(login_url='/login/')
def rider(request):
	profile = getattr(request.user, 'profile', None)
	if profile and profile.role != 'rider':
		return redirect(f'/{profile.role}/')
	return render(request, 'restaurant/home.html', {
		'initial_role': 'rider',
		'page_title': 'ไรเดอร์ - ระบบจัดการร้านอาหาร',
		'current_user': request.user,
		'current_role': 'rider',
	})


@login_required(login_url='/login/')
def admin_panel(request):
	profile = getattr(request.user, 'profile', None)
	if profile and profile.role != 'admin':
		return redirect(f'/{profile.role}/')
	return render(request, 'restaurant/home.html', {
		'initial_role': 'admin',
		'page_title': 'แอดมิน - ระบบจัดการร้านอาหาร',
		'current_user': request.user,
		'current_role': 'admin',
	})

def logout_view(request):
	dj_logout(request)
	return redirect('login')


def custom_404(request, exception):
	"""Custom 404 handler (Thai)"""
	return render(request, '404.html', status=404)


# -------------------------
# API ENDPOINTS (JSON)
# -------------------------

def _parse_json(request):
	import json
	try:
		return json.loads(request.body.decode('utf-8'))
	except Exception:
		return {}


def _apply_voucher(voucher: Voucher | None, subtotal: Decimal, delivery_fee: Decimal):
	discount = Decimal('0.00')
	free_ship = False
	if not voucher:
		return discount, delivery_fee, free_ship
	now = timezone.now()
	if not voucher.active:
		return discount, delivery_fee, free_ship
	if voucher.start_at and voucher.start_at > now:
		return discount, delivery_fee, free_ship
	if voucher.end_at and voucher.end_at < now:
		return discount, delivery_fee, free_ship
	if subtotal < (voucher.min_spend or Decimal('0.00')):
		return discount, delivery_fee, free_ship
	if voucher.discount_type == Voucher.DISCOUNT_PERCENT:
		discount = (subtotal * (voucher.amount or Decimal('0.00')) / Decimal('100')).quantize(Decimal('0.01'))
	elif voucher.discount_type == Voucher.DISCOUNT_FIXED:
		discount = (voucher.amount or Decimal('0.00'))
	elif voucher.discount_type == Voucher.DISCOUNT_FREE_SHIP:
		free_ship = True
	if voucher.max_discount and discount > voucher.max_discount:
		discount = voucher.max_discount
	if free_ship:
		delivery_fee = Decimal('0.00')
	if discount < 0:
		discount = Decimal('0.00')
	return discount, delivery_fee, free_ship


@csrf_exempt
@require_POST
def api_orders_create(request):
	if not request.user.is_authenticated:
		return HttpResponseForbidden('Authentication required')
	payload = _parse_json(request)
	# Allow both adapters: raw order or wrapper with data JSON
	order_data = payload.get('order')
	if not order_data and 'data' in payload:
		import json
		try:
			order_data = json.loads(payload['data'])
		except Exception:
			order_data = None
	if not order_data:
		# Some callers post the order object directly (no wrapper)
		order_data = payload
	if not isinstance(order_data, dict):
		return HttpResponseBadRequest('Invalid order payload')

	# Extract fields with safe defaults
	order_type = order_data.get('type') or order_data.get('order_type') or 'delivery'
	address_text = order_data.get('address') or order_data.get('address_text') or ''
	table_number = order_data.get('tableNumber') or ''
	lat = order_data.get('lat')
	lng = order_data.get('lng')
	voucher_code = order_data.get('voucherCode')
	items = order_data.get('items') or []
	subtotal = Decimal(str(order_data.get('subtotal') or '0'))
	delivery_fee = Decimal(str(order_data.get('deliveryFee') or '0'))

	voucher = None
	if voucher_code:
		try:
			voucher = Voucher.objects.get(code__iexact=voucher_code)
		except Voucher.DoesNotExist:
			voucher = None

	discount, eff_delivery_fee, _ = _apply_voucher(voucher, subtotal, delivery_fee)
	total = (subtotal - discount + eff_delivery_fee).quantize(Decimal('0.01'))

	order = Order.objects.create(
		user=request.user,
		order_type=order_type,
		table_number=table_number or '',
		address_text=address_text or '',
		lat=lat if isinstance(lat, (int, float)) else None,
		lng=lng if isinstance(lng, (int, float)) else None,
		subtotal=subtotal,
		delivery_fee=eff_delivery_fee,
		discount_amount=discount,
		total=total,
		status=Order.STATUS_PENDING,
		voucher=voucher,
	)

	for it in items:
		name = it.get('name') or ''
		qty = int(it.get('quantity') or 1)
		unit_price = Decimal(str(it.get('price') or '0'))
		total_price = (unit_price * qty).quantize(Decimal('0.01'))
		OrderItem.objects.create(
			order=order,
			menu_item=None,
			food_set=None,
			quantity=qty,
			unit_price=unit_price,
			total_price=total_price,
			note=(it.get('note') or '')[:255],
		)

	# Create basic payment record
	method_raw = (order_data.get('paymentMethod') or '').lower()
	method = Payment.METHOD_QR if method_raw == 'qr' else Payment.METHOD_CASH
	Payment.objects.create(order=order, method=method, amount=total, status='unpaid')

	# Create rider assignment for delivery/takeaway
	if order_type in (Order.TYPE_DELIVERY, Order.TYPE_TAKEAWAY):
		RiderAssignment.objects.create(order=order, status='available')

	return JsonResponse({
		'id': order.pk,
		'status': order.status,
		'total': str(order.total),
	})


@login_required(login_url='/login/')
@require_GET
def api_orders_my(request):
	qs = Order.objects.filter(user=request.user).order_by('-created_at')[:100]
	data = []
	for o in qs:
		data.append({
			'id': o.pk,
			'order_type': o.order_type,
			'status': o.status,
			'subtotal': str(o.subtotal),
			'delivery_fee': str(o.delivery_fee),
			'discount_amount': str(o.discount_amount),
			'total': str(o.total),
			'created_at': o.created_at.isoformat(),
		})
	return JsonResponse({'orders': data})


@csrf_exempt
@require_POST
def api_vouchers_validate(request):
	if not request.user.is_authenticated:
		return HttpResponseForbidden('Authentication required')
	payload = _parse_json(request)
	code = (payload.get('code') or '').strip()
	subtotal = Decimal(str(payload.get('subtotal') or '0'))
	delivery_fee = Decimal(str(payload.get('delivery_fee') or '0'))
	voucher = None
	if code:
		try:
			voucher = Voucher.objects.get(code__iexact=code)
		except Voucher.DoesNotExist:
			voucher = None
	discount, eff_delivery_fee, free_ship = _apply_voucher(voucher, subtotal, delivery_fee)
	return JsonResponse({
		'valid': voucher is not None,
		'discount': str(discount),
		'delivery_fee': str(eff_delivery_fee),
		'free_ship': free_ship,
	})


@login_required(login_url='/login/')
@require_GET
def api_rider_jobs_available(request):
	# rider sees both delivery and takeaway orders that are ready
	qs = Order.objects.filter(order_type__in=[Order.TYPE_DELIVERY, Order.TYPE_TAKEAWAY], status=Order.STATUS_READY)
	jobs = []
	for o in qs:
		jobs.append({'id': o.pk, 'order_type': o.order_type, 'total': str(o.total), 'address': o.address_text})
	return JsonResponse({'jobs': jobs})


@csrf_exempt
@require_POST
def api_rider_accept(request, order_id: int):
	if not request.user.is_authenticated:
		return HttpResponseForbidden('Authentication required')
	try:
		order = Order.objects.get(pk=order_id)
	except Order.DoesNotExist:
		return HttpResponseBadRequest('Order not found')
	ra, _ = RiderAssignment.objects.get_or_create(order=order)
	if ra.rider and ra.rider != request.user:
		return HttpResponseForbidden('Already accepted by another rider')
	ra.rider = request.user
	ra.accepted_at = timezone.now()
	ra.status = 'accepted'
	ra.save()
	return JsonResponse({'ok': True})


@csrf_exempt
@require_POST
def api_rider_picked(request, order_id: int):
	if not request.user.is_authenticated:
		return HttpResponseForbidden('Authentication required')
	try:
		order = Order.objects.get(pk=order_id)
	except Order.DoesNotExist:
		return HttpResponseBadRequest('Order not found')
	ra, _ = RiderAssignment.objects.get_or_create(order=order)
	if ra.rider != request.user:
		return HttpResponseForbidden('Not your assignment')
	ra.picked_at = timezone.now()
	ra.status = 'delivering'
	ra.save()
	order.status = Order.STATUS_DELIVERING
	order.save(update_fields=['status'])
	return JsonResponse({'ok': True})


@csrf_exempt
@require_POST
def api_rider_complete(request, order_id: int):
	if not request.user.is_authenticated:
		return HttpResponseForbidden('Authentication required')
	try:
		order = Order.objects.get(pk=order_id)
	except Order.DoesNotExist:
		return HttpResponseBadRequest('Order not found')
	ra, _ = RiderAssignment.objects.get_or_create(order=order)
	if ra.rider != request.user:
		return HttpResponseForbidden('Not your assignment')
	ra.delivered_at = timezone.now()
	ra.status = 'completed'
	ra.save()
	order.status = Order.STATUS_COMPLETED
	order.save(update_fields=['status'])
	return JsonResponse({'ok': True})
