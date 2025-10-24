// Customer module: extracted from app.js without behavior changes
// Depends on globals: cart, favorites, orders, menuItems, vouchers, selectedVoucherCode,
// currentUser, defaultConfig, setPlaceholderImg, PLACEHOLDER_IMAGE, showNotification,
// saveCart, saveFavorites, saveOrders, getRoleDisplayName, applyDiscount

// Recommended section
function switchRecommended(tab) {
  const bestBtn = document.getElementById('tabBest');
  const valueBtn = document.getElementById('tabValue');
  if (bestBtn && valueBtn) {
    if (tab === 'best') {
      bestBtn.classList.add('bg-gray-900', 'text-white');
      valueBtn.classList.remove('bg-gray-900', 'text-white');
      valueBtn.classList.add('text-gray-700');
    } else {
      valueBtn.classList.add('bg-gray-900', 'text-white');
      bestBtn.classList.remove('bg-gray-900', 'text-white');
      bestBtn.classList.add('text-gray-700');
    }
  }
  renderRecommended(tab);
}

function renderRecommended(tab) {
  const grid = document.getElementById('recommendedGrid');
  if (!grid) return;
  let items = [];
  if (tab === 'value') {
    items = menuItems.filter((i) => i.available).sort((a, b) => a.price - b.price).slice(0, 8);
  } else {
    const featured = menuItems.filter((i) => i.featured && i.available);
    const mains = menuItems.filter((i) => i.category === 'main' && i.available);
    items = [...featured, ...mains].slice(0, 8);
  }
  grid.innerHTML = items.map((item) => `
    <div class="bg-white rounded-2xl shadow-sm overflow-hidden border">
      <div class="h-40 bg-gray-200 cursor-pointer" onclick="orderFromImage('${item.id}')">
        <img src="${item.image || PLACEHOLDER_IMAGE}" alt="${item.name}" class="w-full h-full object-cover" onerror="setPlaceholderImg(this, 'รูปภาพไม่พร้อมใช้งาน')" />
      </div>
      <div class="p-4">
        <div class="flex items-center justify-between mb-2">
          <span class="px-2 py-1 text-[10px] rounded-full bg-purple-100 text-purple-700">${tab === 'best' ? 'POPULAR' : 'VALUE'}</span>
          <span class="text-orange-600 font-bold">${item.price} บาท</span>
        </div>
        <h4 class="font-semibold mb-1">${item.name}</h4>
        <p class="text-xs text-gray-500 mb-3">#${item.category}</p>
        <div class="flex gap-2">
          <button onclick="addToCart('${item.id}')" class="btn-primary text-white px-3 py-2 rounded-md text-sm"><i class="fas fa-plus mr-1"></i>สั่งเลย</button>
          <button onclick="toggleFavorite('${item.id}')" class="px-3 py-2 rounded-md border text-sm"><i class="fas fa-heart mr-1"></i>โปรด</button>
        </div>
      </div>
    </div>`).join('');
}

// Customer nav
function showCustomerSection(section) {
  document.querySelectorAll('.customer-nav-btn').forEach((btn) => {
    btn.classList.remove('active', 'border-blue-500', 'text-blue-600');
    btn.classList.add('border-transparent', 'text-gray-500');
  });
  if (window.event && window.event.currentTarget) {
    const t = window.event.currentTarget;
    t.classList.add('active', 'border-blue-500', 'text-blue-600');
    t.classList.remove('border-transparent', 'text-gray-500');
  }
  document.querySelectorAll('.customer-section').forEach((sec) => sec.classList.add('hidden'));
  const map = { home: 'customerHome', menu: 'customerMenu', favorites: 'customerFavorites', orders: 'customerOrders', cart: 'customerCart' };
  const id = map[section];
  if (id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('hidden');
    if (section === 'orders') loadCustomerOrders();
    if (section === 'favorites') loadFavorites();
    if (section === 'cart') { updateCartDisplay(); renderPaymentSection(); }
  }
}

function loadFeaturedMenu() {
  const container = document.getElementById('featuredMenu');
  if (!container) return;
  const featured = menuItems.filter((i) => i.featured && i.available);
  container.innerHTML = featured.map((item) => `
    <div class="food-card bg-white rounded-xl shadow-lg overflow-hidden">
      <div class="h-48 bg-gray-200 relative">
        <img src="${item.image || PLACEHOLDER_IMAGE}" alt="${item.name}" class="w-full h-full object-cover" onerror="setPlaceholderImg(this, 'รูปภาพไม่พร้อมใช้งาน')" />
        <button onclick="toggleFavorite('${item.id}')" class="absolute top-2 right-2 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-md hover:bg-gray-50">
          <i class="fas fa-heart ${favorites.includes(item.id) ? 'text-red-500' : 'text-gray-400'}"></i>
        </button>
      </div>
      <div class="p-4">
        <h4 class="font-bold text-lg mb-2">${item.name}</h4>
        <p class="text-gray-600 text-sm mb-3">${item.description}</p>
        <div class="flex justify-between items-center">
          <span class="text-xl font-bold text-orange-500">${item.price} บาท</span>
          <button onclick="addToCart('${item.id}')" class="btn-primary text-white px-4 py-2 rounded-lg text-sm"><i class="fas fa-plus mr-1"></i>เพิ่ม</button>
        </div>
      </div>
    </div>`).join('');
}

function loadMenuGrid() {
  const container = document.getElementById('menuGrid');
  if (!container) return;
  let items = menuItems.filter((i) => i.available);
  const categoryFilter = document.getElementById('categoryFilter');
  if (categoryFilter && categoryFilter.value) items = items.filter((i) => i.category === categoryFilter.value);
  const searchInput = document.getElementById('menuSearch');
  if (searchInput && searchInput.value) {
    const term = searchInput.value.toLowerCase();
    items = items.filter((i) => i.name.toLowerCase().includes(term) || i.description.toLowerCase().includes(term));
  }
  container.innerHTML = items.map((item) => `
    <div class="food-card bg-white rounded-xl shadow-lg overflow-hidden">
      <div class="h-48 bg-gray-200 relative cursor-pointer" onclick="orderFromImage('${item.id}')">
        <img src="${item.image || PLACEHOLDER_IMAGE}" alt="${item.name}" class="w-full h-full object-cover" onerror="setPlaceholderImg(this, 'รูปภาพไม่พร้อมใช้งาน')" />
        <button onclick="toggleFavorite('${item.id}')" class="absolute top-2 right-2 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-md hover:bg-gray-50">
          <i class="fas fa-heart ${favorites.includes(item.id) ? 'text-red-500' : 'text-gray-400'}"></i>
        </button>
      </div>
      <div class="p-4">
        <h4 class="font-bold text-lg mb-2">${item.name}</h4>
        <p class="text-gray-600 text-sm mb-3">${item.description}</p>
        <div class="flex justify-between items-center">
          <span class="text-xl font-bold text-orange-500">${item.price} บาท</span>
          <button onclick="addToCart('${item.id}')" class="btn-primary text-white px-4 py-2 rounded-lg text-sm"><i class="fas fa-plus mr-1"></i>เพิ่ม</button>
        </div>
      </div>
    </div>`).join('');
}

function toggleFavorite(menuId) {
  const idx = favorites.indexOf(menuId);
  if (idx > -1) {
    favorites.splice(idx, 1);
    showNotification('ลบออกจากเมนูโปรดแล้ว', 'success');
  } else {
    favorites.push(menuId);
    showNotification('เพิ่มในเมนูโปรดแล้ว', 'success');
  }
  saveFavorites();
  loadFeaturedMenu();
  loadMenuGrid();
  loadFavorites();
}

function loadFavorites() {
  const container = document.getElementById('favoritesGrid');
  if (!container) return;
  const favItems = menuItems.filter((i) => favorites.includes(i.id) && i.available);
  if (favItems.length === 0) {
    container.innerHTML = `
      <div class="col-span-full text-center py-12">
        <div class="text-6xl mb-4">💔</div>
        <h3 class="text-xl font-bold text-gray-600 mb-2">ยังไม่มีเมนูโปรด</h3>
        <p class="text-gray-500">กดปุ่มหัวใจที่เมนูที่คุณชอบเพื่อเพิ่มในรายการโปรด</p>
      </div>`;
    return;
  }
  container.innerHTML = favItems.map((item) => `
    <div class="food-card bg-white rounded-xl shadow-lg overflow-hidden">
      <div class="h-48 bg-gray-200 relative">
        <img src="${item.image || PLACEHOLDER_IMAGE}" alt="${item.name}" class="w-full h-full object-cover" onerror="setPlaceholderImg(this, 'รูปภาพไม่พร้อมใช้งาน')" />
        <button onclick="toggleFavorite('${item.id}')" class="absolute top-2 right-2 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-md hover:bg-gray-50">
          <i class="fas fa-heart text-red-500"></i>
        </button>
      </div>
      <div class="p-4">
        <h4 class="font-bold text-lg mb-2">${item.name}</h4>
        <p class="text-gray-600 text-sm mb-3">${item.description}</p>
        <div class="flex justify-between items-center">
          <span class="text-xl font-bold text-orange-500">${item.price} บาท</span>
          <button onclick="addToCart('${item.id}')" class="btn-primary text-white px-4 py-2 rounded-lg text-sm"><i class="fas fa-plus mr-1"></i>เพิ่ม</button>
        </div>
      </div>
    </div>`).join('');
}

function addToCart(menuId) {
  const item = menuItems.find((m) => m.id === menuId);
  if (!item) return;
  const existing = cart.find((c) => c.id === menuId);
  if (existing) existing.quantity += 1;
  else cart.push({ id: menuId, name: item.name, price: item.price, quantity: 1, image: item.image });
  updateCartDisplay();
  saveCart();
  showNotification(`เพิ่ม ${item.name} ลงตะกร้าแล้ว`, 'success');
}

function orderFromImage(menuId) {
  try {
    addToCart(menuId);
    if (typeof showCustomerSection === 'function') {
      showCustomerSection('cart');
    }
  } catch (_) {}
}

function removeFromCart(menuId) {
  const idx = cart.findIndex((c) => c.id === menuId);
  if (idx > -1) {
    cart.splice(idx, 1);
    updateCartDisplay();
    saveCart();
    showNotification('ลบสินค้าออกจากตะกร้าแล้ว', 'success');
  }
}

function updateCartQuantity(menuId, change) {
  const item = cart.find((c) => c.id === menuId);
  if (!item) return;
  item.quantity += change;
  if (item.quantity <= 0) removeFromCart(menuId);
  else { updateCartDisplay(); saveCart(); }
}

function updateCartDisplay() {
  const cartCount = document.getElementById('cartCount');
  const cartItems = document.getElementById('cartItems');
  const totalItems = cart.reduce((s, i) => s + i.quantity, 0);
  if (cartCount) {
    if (totalItems > 0) {
      const display = totalItems > 99 ? '99+' : totalItems;
      cartCount.textContent = display;
      cartCount.classList.remove('hidden');
    } else cartCount.classList.add('hidden');
  }
  if (cartItems) {
    if (cart.length === 0) {
      cartItems.innerHTML = `
        <div class="text-center py-12">
          <div class="text-6xl mb-4">🛒</div>
          <h3 class="text-xl font-bold text-gray-600 mb-2">ตะกร้ายังว่างอยู่</h3>
          <p class="text-gray-500 mb-4">ไปเลือกเมนูอร่อยๆ ได้ที่หน้าเมนู</p>
          <button onclick="showCustomerSection('menu')" class="btn-primary text-white px-5 py-2 rounded-lg">ดูเมนูอาหาร</button>
        </div>`;
    } else {
      cartItems.innerHTML = cart.map((item) => `
        <div class="flex items-center gap-4 p-4 border border-gray-200 rounded-lg">
          <img src="${item.image || PLACEHOLDER_IMAGE}" alt="${item.name}" class="w-16 h-16 object-cover rounded-lg" onerror="setPlaceholderImg(this, 'รูปภาพไม่พร้อมใช้งาน')" />
          <div class="flex-1 min-w-0">
            <h4 class="font-semibold truncate">${item.name}</h4>
            <div class="text-sm text-gray-500">${item.price} บาท/จาน</div>
          </div>
          <div class="flex items-center space-x-2">
            <button aria-label="ลดจำนวน" onclick="updateCartQuantity('${item.id}', -1)" class="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center hover:bg-gray-300"><i class="fas fa-minus text-sm"></i></button>
            <span class="w-8 text-center font-semibold">${item.quantity}</span>
            <button aria-label="เพิ่มจำนวน" onclick="updateCartQuantity('${item.id}', 1)" class="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center hover:bg-gray-300"><i class="fas fa-plus text-sm"></i></button>
          </div>
          <div class="w-24 text-right font-semibold text-gray-800">${item.price * item.quantity} บาท</div>
          <button aria-label="ลบออก" onclick="removeFromCart('${item.id}')" class="text-red-500 hover:text-red-700"><i class="fas fa-trash"></i></button>
        </div>`).join('');
    }
  }
  updateCartTotal();
}

function clearCart() {
  if (cart.length === 0) return;
  cart = [];
  saveCart();
  updateCartDisplay();
  showNotification('ล้างตะกร้าแล้ว', 'success');
}

function updateCartTotal() {
  const cartTotal = document.getElementById('cartTotal');
  if (!cartTotal) return;
  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const orderType = document.getElementById('orderType');
  const type = orderType ? orderType.value : 'delivery';
  const deliveryFee = (type === 'delivery') ? parseInt((window.elementSdk && window.elementSdk.config && window.elementSdk.config.delivery_fee) || defaultConfig.delivery_fee) : 0;
  populateVoucherSelect(subtotal);
  let voucherDiscount = 0;
  const v = getSelectedVoucher();
  if (v && v.active && subtotal >= (parseFloat(v.min) || 0)) {
    const finalAfterVoucher = applyDiscount(subtotal, { type: v.type, value: parseFloat(v.value) || 0, active: true });
    voucherDiscount = Math.max(0, subtotal - finalAfterVoucher);
  }
  const total = Math.max(0, subtotal - voucherDiscount) + deliveryFee;
  cartTotal.innerHTML = `
    <div class="space-y-2">
      <div class="flex justify-between"><span>ราคาอาหาร:</span><span>${subtotal} บาท</span></div>
      ${voucherDiscount > 0 ? `<div class="flex justify-between text-green-600"><span>ส่วนลดคูปอง:</span><span>-${voucherDiscount} บาท</span></div>` : ''}
      ${deliveryFee > 0 ? `<div class="flex justify-between"><span>ค่าส่ง:</span><span>${deliveryFee} บาท</span></div>` : ''}
      <div class="border-t pt-2 flex justify-between font-bold text-lg"><span>รวมทั้งหมด:</span><span>${total} บาท</span></div>
    </div>`;
}

async function checkout() {
  try {
    if (cart.length === 0) return showNotification('กรุณาเพิ่มสินค้าในตะกร้าก่อน', 'error');
    if (allData.length >= 999) return showNotification('ระบบเต็ม ไม่สามารถสร้างออเดอร์ใหม่ได้', 'error');
    const orderType = document.getElementById('orderType').value;
    const deliveryAddress = (document.getElementById('deliveryAddressText') || {}).value;
    const lat = parseFloat((document.getElementById('deliveryLat') || {}).value);
    const lng = parseFloat((document.getElementById('deliveryLng') || {}).value);
    const useCurr = !!((document.getElementById('useCurrentAddressOnly') || {}).checked);
  if (orderType === 'delivery') {
      const hasCoords = !isNaN(lat) && !isNaN(lng);
      if (!useCurr && !deliveryAddress) return showNotification('กรุณาใส่ที่อยู่สำหรับจัดส่ง หรือเลือกใช้ที่อยู่ปัจจุบัน', 'error');
      if (useCurr && !hasCoords) return showNotification('ยังไม่มีพิกัดปัจจุบัน กรุณากด “ใช้ตำแหน่งปัจจุบัน”', 'error');
    }
    const payQrEl = document.getElementById('payQr');
    const payCodEl = document.getElementById('payCod');
    const payStaffEl = document.getElementById('payStaff');
    const paymentMethod = (payQrEl && payQrEl.checked) ? 'qr' : (payCodEl && payCodEl.checked) ? 'cod' : (payStaffEl && payStaffEl.checked) ? 'staff' : (orderType === 'dine-in' ? 'staff' : 'cod');
    if (orderType === 'dine-in' && paymentMethod === 'cod') return showNotification('ทานในร้านไม่รองรับชำระปลายทาง กรุณาเลือกชำระที่พนักงานหรือ QR', 'error');
    if (orderType === 'dine-in') { openTableNumberModal(); return; }
    return checkoutFinalize(null);
  } catch (e) {
    console.error('Checkout error:', e);
    showNotification('เกิดข้อผิดพลาดในการสั่งอาหาร', 'error');
  }
}

function openTableNumberModal() {
  const m = document.getElementById('tableNumberModal');
  const inp = document.getElementById('tableNumberInput');
  if (m) m.classList.remove('hidden');
  if (inp) { inp.value = ''; inp.focus(); }
}
function closeTableNumberModal() {
  const m = document.getElementById('tableNumberModal');
  if (m) m.classList.add('hidden');
}
function confirmTableNumber() {
  const inp = document.getElementById('tableNumberInput');
  const val = (inp && inp.value || '').trim();
  if (!val) { showNotification('กรุณากรอกเลขโต๊ะ', 'error'); return; }
  closeTableNumberModal();
  checkoutFinalize(val);
}
async function checkoutFinalize(tableNumber) {
  try {
  const orderType = document.getElementById('orderType').value;
  const deliveryAddress = (document.getElementById('deliveryAddressText') || {}).value;
  const lat = parseFloat((document.getElementById('deliveryLat') || {}).value);
  const lng = parseFloat((document.getElementById('deliveryLng') || {}).value);
  const payQrEl = document.getElementById('payQr');
  const payCodEl = document.getElementById('payCod');
  const payStaffEl = document.getElementById('payStaff');
  const paymentMethod = (payQrEl && payQrEl.checked) ? 'qr' : (payCodEl && payCodEl.checked) ? 'cod' : (payStaffEl && payStaffEl.checked) ? 'staff' : (orderType === 'dine-in' ? 'staff' : 'cod');
  const orderId = 'order_' + Date.now();
  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const deliveryFee = (orderType === 'delivery') ? parseInt((window.elementSdk && window.elementSdk.config && window.elementSdk.config.delivery_fee) || defaultConfig.delivery_fee) : 0;
  let voucherDiscount = 0;
  let voucherCode = null;
  let voucherSnapshot = null;
  const selVoucher = getSelectedVoucher();
  if (selVoucher && selVoucher.active && subtotal >= (parseFloat(selVoucher.min) || 0)) {
    const finalAfterVoucher = applyDiscount(subtotal, { type: selVoucher.type, value: parseFloat(selVoucher.value) || 0, active: true });
    voucherDiscount = Math.max(0, subtotal - finalAfterVoucher);
    voucherCode = selVoucher.code;
    voucherSnapshot = { code: selVoucher.code, type: selVoucher.type, value: selVoucher.value, min: selVoucher.min };
  }
  const order = {
    id: orderId,
    customerId: (currentUser && currentUser.id) || 'demo_customer',
    customerName: currentUser ? currentUser.name : 'ลูกค้าทดสอบ',
    items: [...cart],
    type: orderType,
    address: deliveryAddress || '',
    lat: isNaN(lat) ? null : lat,
    lng: isNaN(lng) ? null : lng,
    paymentMethod,
    paymentStatus: paymentMethod === 'qr' ? 'awaiting' : (paymentMethod === 'staff' ? 'awaiting-staff' : 'pending'),
    subtotal,
    deliveryFee,
    voucherCode,
    voucherDiscount,
    total: Math.max(0, subtotal - voucherDiscount) + deliveryFee,
    status: 'pending',
    timestamp: new Date().toISOString(),
    estimatedTime: 30,
    voucher: voucherSnapshot,
    tableNumber: orderType === 'dine-in' ? (tableNumber || '') : '',
  };
  if (window.dataSdk && typeof window.dataSdk.create === 'function') {
    const result = await window.dataSdk.create({ type: 'order', data: JSON.stringify(order), userId: order.customerId, status: 'pending', timestamp: order.timestamp });
    if (!result || !result.isOk) return showNotification('เกิดข้อผิดพลาดในการสั่งอาหาร', 'error');
  }
  orders.push(order);
  saveOrders();
  cart = [];
  updateCartDisplay();
  saveCart();
  logAction('order', `สร้างออเดอร์ใหม่ #${orderId}${order.type==='dine-in' && order.tableNumber ? ' (โต๊ะ '+order.tableNumber+')' : ''}`);
  showNotification('สั่งอาหารสำเร็จ! กำลังเตรียมอาหารให้คุณ', 'success');
  showCustomerSection('orders');
  } catch (e) {
    console.error('Checkout finalize error:', e);
    showNotification('เกิดข้อผิดพลาดในการสั่งอาหาร', 'error');
  }
}

function loadCustomerOrders() {
  const container = document.getElementById('ordersHistory');
  if (!container) return;
  const cid = (currentUser && currentUser.id) || 'demo_customer';
  const myOrders = orders.filter((o) => o.customerId === cid);
  if (myOrders.length === 0) {
    container.innerHTML = `
      <div class="text-center py-12">
        <div class="text-6xl mb-4">📋</div>
        <h3 class="text-xl font-bold text-gray-600 mb-2">ยังไม่มีออเดอร์</h3>
        <p class="text-gray-500">เริ่มสั่งอาหารเพื่อดูประวัติออเดอร์ของคุณ</p>
      </div>`;
    return;
  }
  container.innerHTML = myOrders.map((order) => `
    <div class="bg-white rounded-xl shadow-lg p-6">
      <div class="flex justify-between items-start mb-4">
        <div>
          <h3 class="text-lg font-bold">ออเดอร์ #${order.id.slice(-8)}</h3>
          <p class="text-gray-600">${new Date(order.timestamp).toLocaleString('th-TH')}</p>
          <div class="mt-1">
            <span class="px-2 py-0.5 rounded text-xs ${order.type==='delivery' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-700'}">${order.type==='delivery' ? 'เดลิเวอรี่' : 'ทานในร้าน'}</span>
          </div>
          ${order.type === 'dine-in' && order.tableNumber ? `<div class="text-xs text-gray-700 mt-1">โต๊ะ: <span class="font-semibold">${order.tableNumber}</span></div>` : ''}
          ${order.type === 'dine-in' && order.tableNumber ? `<div class="text-xs text-gray-700 mt-1">ช่วงเวลา: ${getOrderTypeDisplay(order)}</div>` : ''}
        </div>
        <div class="text-right">
          ${getOrderStatusBadge(order)}
          <p class="text-lg font-bold mt-1">${order.total} บาท</p>
        </div>
      </div>
      <div class="space-y-2 mb-4">
        ${order.items.map((it) => `<div class="flex justify-between"><span>${it.name} x${it.quantity}</span><span>${it.price * it.quantity} บาท</span></div>`).join('')}
      </div>
      <div class="flex space-x-2">${getOrderActionButtons(order)}</div>
    </div>`).join('');
}

function reorder(orderId) {
  const order = orders.find((o) => o.id === orderId);
  if (!order) return;
  cart = [...order.items.map((i) => ({ ...i }))];
  updateCartDisplay();
  saveCart();
  showCustomerSection('cart');
  showNotification('เพิ่มรายการจากออเดอร์เดิมลงตะกร้าแล้ว', 'success');
}

function getOrderTypeDisplay(order) {
  const orderDate = new Date(order.timestamp);
  return orderDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
}

function getOrderStatusBadge(order) {
  if (order.status === 'served' || order.status === 'delivered') {
    return '<span class="inline-block px-3 py-1 text-sm rounded-full bg-yellow-100 text-yellow-800">รอชำระเงิน</span>';
  }
  if (order.status === 'completed') {
    return '<span class="inline-block px-3 py-1 text-sm rounded-full bg-green-100 text-green-800">ชำระเงินแล้ว</span>';
  }
  const statusMap = {
    'pending': '<span class="inline-block px-3 py-1 text-sm rounded-full bg-gray-100 text-gray-800">รอดำเนินการ</span>',
    'preparing': '<span class="inline-block px-3 py-1 text-sm rounded-full bg-blue-100 text-blue-800">กำลังเตรียม</span>',
    'ready': '<span class="inline-block px-3 py-1 text-sm rounded-full bg-purple-100 text-purple-800">พร้อมเสิร์ฟ</span>',
    'delivering': '<span class="inline-block px-3 py-1 text-sm rounded-full bg-indigo-100 text-indigo-800">กำลังส่ง</span>',
    'cancelled': '<span class="inline-block px-3 py-1 text-sm rounded-full bg-red-100 text-red-800">ยกเลิก</span>'
  };
  return statusMap[order.status] || '<span class="inline-block px-3 py-1 text-sm rounded-full bg-gray-100 text-gray-800">' + order.status + '</span>';
}

function getOrderActionButtons(order) {
  let buttons = '';
  if (order.status === 'served' || order.status === 'delivered') {
    buttons += `<button onclick="resendOrder('${order.id}')" class="flex-1 bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600"><i class="fas fa-sync mr-2"></i>ส่งซ้ำ</button>`;
  }
  // Remove customer-side payment confirmation button; only staff can confirm
  if (order.status === 'completed') {
    buttons += `<button onclick="reorder('${order.id}')" class="flex-1 bg-green-500 text-white py-2 px-4 rounded-lg hover:bg-green-600"><i class="fas fa-redo mr-2"></i>สั่งซ้ำ</button>`;
  }
  return buttons || '<div class="text-sm text-gray-500 text-center py-2">กำลังดำเนินการ...</div>';
}

function resendOrder(orderId) {
  showNotification('ส่งคำขอไปยังครัวแล้ว', 'info');
  logAction('order', `ลูกค้าขอส่งซ้ำออเดอร์ #${orderId}`);
}

function customerConfirmPayment(orderId) {
  // Disabled by policy: Only staff can confirm payments.
  showNotification('การยืนยันการชำระเงินทำได้โดยพนักงานเท่านั้น', 'info');
}

function renderPaymentSection() {
  const orderTypeSel = document.getElementById('orderType');
  const deliveryAddress = document.getElementById('deliveryAddress');
  const payCod = document.getElementById('payCod');
  const payQr = document.getElementById('payQr');
  const payStaff = document.getElementById('payStaff');
  const qrWrap = document.getElementById('paymentQR');
  if (!orderTypeSel) return;
  const type = orderTypeSel.value;
  // Show address for delivery; hide for dine-in
  if (deliveryAddress) deliveryAddress.style.display = (type === 'delivery') ? 'block' : 'none';
  if (payCod) {
    const codWrap = payCod.closest && payCod.closest('label');
  const showCod = (type === 'delivery');
    payCod.disabled = !showCod;
    if (!showCod) { payCod.checked = false; if (codWrap) codWrap.style.display = 'none'; }
    else { if (codWrap) codWrap.style.display = ''; }
  }
  if (payStaff) {
    const staffWrap = payStaff.closest && payStaff.closest('label');
    const showStaff = type === 'dine-in';
    payStaff.disabled = !showStaff;
    if (!showStaff) { payStaff.checked = false; if (staffWrap) staffWrap.style.display = 'none'; }
    else { if (staffWrap) staffWrap.style.display = ''; }
  }
  if (payQr) {
    const qrWrapLabel = payQr.closest && payQr.closest('label');
  if (type === 'delivery') {
      if (!(payCod && payCod.checked) && !(payQr && payQr.checked)) { if (payCod) payCod.checked = true; }
      if (qrWrapLabel) qrWrapLabel.style.display = '';
    } else {
      const nothingSelected = !(payQr && payQr.checked) && !(payStaff && payStaff.checked);
      if (nothingSelected && payStaff) payStaff.checked = true;
      if (qrWrapLabel) qrWrapLabel.style.display = '';
    }
  }
  const usingQr = !!(payQr && payQr.checked);
  if (qrWrap) {
    if (usingQr) { qrWrap.classList.remove('hidden'); generateCustomerPaymentQR(); }
    else qrWrap.classList.add('hidden');
  }
  updateCartTotal();
}

function generateCustomerPaymentQR() {
  const target = document.getElementById('paymentQRCode');
  if (!target) return;
  const data = (document.getElementById('qrCodeData') || {}).value || '0812345678';
  target.textContent = '';
  target.innerHTML = `<div class="text-xs text-gray-600">📱 QR Code<br/>${data}</div>`;
}

// Export to window
Object.assign(window, {
  switchRecommended,
  renderRecommended,
  showCustomerSection,
  loadFeaturedMenu,
  loadMenuGrid,
  toggleFavorite,
  loadFavorites,
  addToCart,
  orderFromImage,
  removeFromCart,
  updateCartQuantity,
  updateCartDisplay,
  clearCart,
  updateCartTotal,
  checkout,
  openTableNumberModal,
  closeTableNumberModal,
  confirmTableNumber,
  checkoutFinalize,
  loadCustomerOrders,
  reorder,
  getOrderTypeDisplay,
  getOrderStatusBadge,
  getOrderActionButtons,
  resendOrder,
  customerConfirmPayment,
  renderPaymentSection,
  generateCustomerPaymentQR,
  // voucher helpers from app.js
});
