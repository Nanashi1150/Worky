// Staff module: extracted from app.js without behavior changes
// Depends on global state: orders, currentUser, saveOrders, showNotification, logAction, Chart

// Expose charts holder
let staffCharts = {};

// ===== Staff payment confirmation (legacy + dine-in COD normalization) =====
function confirmStaffPayment(orderId) {
  const o = orders.find((x) => x.id === orderId);
  if (!o) return;
  const isStaffFlow = o.paymentMethod === 'staff' || (o.type === 'dine-in' && o.paymentMethod === 'cod');
  if (!isStaffFlow) return showNotification('ออเดอร์นี้ไม่ได้เป็นการชำระที่พนักงาน', 'error');
  if (o.paymentStatus === 'paid') return showNotification('ชำระเงินแล้ว', 'success');
  o.paymentStatus = 'paid';
  logAction('payment', `ยืนยันการรับชำระ (พนักงาน) สำหรับออเดอร์ #${orderId}`);
  try { loadCustomerOrders && loadCustomerOrders(); } catch(_) {}
  try { loadAdminOrders && loadAdminOrders(); } catch(_) {}
  try { loadStaffOrders && loadStaffOrders(); } catch(_) {}
  showNotification('บันทึกการรับชำระเรียบร้อย', 'success');
}

// ===== Staff - classic orders list (ready to serve) =====
function loadStaffOrders() {
  const container = document.getElementById('staffOrders');
  if (!container) return;
  const readyOrders = orders.filter((o) => o.status === 'ready');
  if (readyOrders.length === 0) {
    container.innerHTML = `
      <div class="text-center py-8"><div class="text-4xl mb-2">✅</div><p class="text-gray-600">ไม่มีออเดอร์ที่รอเสิร์ฟ</p></div>`;
    return;
  }
  container.innerHTML = readyOrders
    .map(
      (order) => `
      <div class="bg-white border border-gray-200 rounded-lg p-4">
        <div class="flex justify-between items-start mb-3">
          <div>
            <h4 class="font-bold">ออเดอร์ #${order.id.slice(-8)}</h4>
            <p class="text-sm text-gray-600">${order.customerName}</p>
            <p class="text-sm text-gray-600">${order.type === 'delivery' ? '🚚 เดลิเวอรี่' : order.type === 'takeaway' ? '🛍️ สั่งกลับบ้าน' : '🏪 ทานในร้าน'}</p>
            ${order.type === 'dine-in' && order.tableNumber ? `<p class="text-sm text-gray-700">โต๊ะ: <span class="font-semibold">${order.tableNumber}</span></p>` : ''}
          </div>
          <span class="text-lg font-bold text-green-600">${order.total} บาท</span>
        </div>
        <div class="space-y-1 mb-3 text-sm">
          ${order.items.map((i) => `<div class="flex justify-between"><span>${i.name} x${i.quantity}</span><span>${i.price * i.quantity} บาท</span></div>`).join('')}
        </div>
        <div class="flex space-x-2">
          ${order.type === 'dine-in'
            ? `${(order.paymentMethod==='staff' || (order.type==='dine-in' && order.paymentMethod==='cod')) && order.paymentStatus!=='paid' ? `<button onclick=\"confirmStaffPayment('${order.id}')\" class=\"flex-1 bg-purple-600 text-white py-2 px-3 rounded text-sm hover:bg-purple-700\"><i class=\"fas fa-hand-holding-usd mr-1\"></i>ยืนยันรับชำระ</button>` : ''}
               <button onclick=\"serveOrder('${order.id}')\" class=\"flex-1 bg-green-500 text-white py-2 px-3 rounded text-sm hover:bg-green-600\"><i class=\"fas fa-check mr-1\"></i>เสิร์ฟแล้ว</button>`
            : `<button onclick=\"assignToRider('${order.id}')\" class=\"flex-1 bg-blue-500 text-white py-2 px-3 rounded text-sm hover:bg-blue-600\"><i class=\"fas fa-motorcycle mr-1\"></i>มอบให้ไรเดอร์</button>`}
        </div>
      </div>`
    )
    .join('');
}

function serveOrder(orderId) {
  const order = orders.find((o) => o.id === orderId);
  if (!order) return;
  const prev = order.status;
  order.status = order.type === 'dine-in' ? 'served' : 'delivered';
  order.servedBy = (currentUser && currentUser.username) || 'พนักงาน';
  order.servedAt = new Date().toISOString();
  saveOrders();
  logAction('order', `เสิร์ฟออเดอร์ #${orderId} (${prev} → ${order.status})`);
  try { loadStaffOrders && loadStaffOrders(); } catch(_) {}
  try { loadStaffStats && loadStaffStats(); } catch(_) {}
  try { loadStaffPayments && loadStaffPayments(); } catch(_) {}
  try { loadAdminOrders && loadAdminOrders(); } catch(_) {}
  try { loadCustomerOrders && loadCustomerOrders(); } catch(_) {}
  showNotification('เสิร์ฟออเดอร์เรียบร้อยแล้ว', 'success');
}

function assignToRider(orderId) {
  const order = orders.find((o) => o.id === orderId);
  if (order) {
    order.status = 'delivering';
    order.riderId = 'rider1';
    logAction('order', `มอบออเดอร์ #${orderId} ให้ไรเดอร์`);
    loadStaffOrders();
    showNotification('มอบออเดอร์ให้ไรเดอร์แล้ว', 'success');
  }
}

function loadStaffStats() {
  const ordersServed = document.getElementById('staffOrdersServed');
  const totalSales = document.getElementById('staffTotalSales');
  if (!ordersServed || !totalSales) return;
  const today = new Date().toDateString();
  const todayOrders = orders.filter((o) => new Date(o.timestamp).toDateString() === today && o.status === 'completed');
  const sales = todayOrders.reduce((s, o) => s + o.total, 0);
  ordersServed.textContent = todayOrders.length;
  totalSales.textContent = `${sales.toLocaleString()} บาท`;
}

// ===== New Staff UI sections =====
function showStaffSection(section, event) {
  document.querySelectorAll('.staff-section').forEach(s => s.classList.add('hidden'));
  document.querySelectorAll('.staff-nav-btn').forEach(btn => {
    btn.classList.remove('active', 'bg-blue-500', 'text-white');
    btn.classList.add('bg-gray-200', 'text-gray-700');
  });
  const targetSection = document.getElementById(`staff${section.charAt(0).toUpperCase() + section.slice(1)}`);
  if (targetSection) targetSection.classList.remove('hidden');
  if (event && event.currentTarget) {
    event.currentTarget.classList.add('active', 'bg-blue-500', 'text-white');
    event.currentTarget.classList.remove('bg-gray-200', 'text-gray-700');
  }
  switch(section) {
    case 'orders':
      loadStaffOrdersSection();
      break;
    case 'payment':
      loadStaffPayments();
      break;
    case 'history':
      loadStaffHistory('day');
      break;
    case 'stats':
      loadStaffStatsSection();
      break;
  }
}

function loadStaffOrdersSection() {
  const ordersList = document.getElementById('staffOrdersList');
  if (!ordersList) return;
  const ordersToServe = orders.filter(order => order.status === 'ready' || order.status === 'delivering');
  if (ordersToServe.length === 0) {
    ordersList.innerHTML = '<p class="text-gray-500 text-center py-8">ไม่มีออเดอร์รอเสิร์ฟ</p>';
    return;
  }
  ordersList.innerHTML = ordersToServe.map(order => `
    <div class="border rounded-lg p-4 bg-white">
      <div class="flex justify-between items-start mb-3">
        <div>
          <h4 class="font-bold text-lg">#${order.id}</h4>
          <p class="text-sm text-gray-600">${order.customerName || 'ลูกค้าทั่วไป'}</p>
          <p class="text-sm text-gray-600">${order.type === 'dine-in' ? 'ทานที่ร้าน' : (order.type === 'delivery' ? 'เดลิเวอรี่' : 'สั่งกลับบ้าน')}</p>
          ${order.tableNumber ? `<p class="text-sm text-gray-600">โต๊ะ ${order.tableNumber}</p>` : ''}
        </div>
        <div class="text-right">
          <p class="font-bold text-lg text-green-600">${order.total} บาท</p>
          <span class="inline-block px-2 py-1 text-xs rounded-full ${order.status === 'ready' ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'}">${order.status === 'ready' ? 'พร้อมเสิร์ฟ' : 'กำลังจัดส่ง'}</span>
        </div>
      </div>
      <div class="border-t pt-3 mb-3">
        <h5 class="font-semibold mb-2">รายการอาหาร:</h5>
        <div class="space-y-1">
          ${order.items.map(item => `
            <div class="flex justify-between text-sm">
              <span>${item.name} x${item.quantity}</span>
              <span>${item.price * item.quantity} บาท</span>
            </div>
          `).join('')}
        </div>
      </div>
      <div class="flex space-x-2">
        <button onclick="serveOrderNew('${order.id}')" class="flex-1 bg-green-500 text-white py-2 px-4 rounded hover:bg-green-600">
          <i class="fas fa-check mr-2"></i>เสิร์ฟแล้ว
        </button>
        <button onclick="viewOrderDetails('${order.id}')" class="flex-1 bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600">
          <i class="fas fa-eye mr-2"></i>ดูรายละเอียด
        </button>
      </div>
    </div>
  `).join('');
}

function loadStaffPayments() {
  const paymentsList = document.getElementById('staffPaymentList');
  if (!paymentsList) { console.warn('staffPaymentList element not found!'); return; }
  const ordersForPayment = orders.filter(order => (order.status === 'served' || order.status === 'delivered') && order.paymentStatus !== 'paid');
  if (ordersForPayment.length === 0) {
    paymentsList.innerHTML = '<p class="text-gray-500 text-center py-8">ไม่มีออเดอร์รอชำระเงิน</p>';
    return;
  }
  paymentsList.innerHTML = ordersForPayment.map(order => `
    <div class="border rounded-lg p-4 bg-white shadow-sm">
      <div class="flex justify-between items-start mb-3">
        <div>
          <h4 class="font-bold text-lg">#${order.id}</h4>
          <p class="text-sm text-gray-600">${order.customerName || 'ลูกค้าทั่วไป'}</p>
          <p class="text-sm text-gray-600">${order.type === 'dine-in' ? 'ทานที่ร้าน' : (order.type === 'delivery' ? 'เดลิเวอรี่' : 'สั่งกลับบ้าน')}</p>
          ${order.tableNumber ? `<p class=\"text-sm text-gray-600\">โต๊ะ ${order.tableNumber}</p>` : ''}
          ${order.servedBy ? `<p class=\"text-xs text-blue-600 mt-1\"><i class=\"fas fa-user-check mr-1\"></i>เสิร์ฟโดย: ${order.servedBy}</p>` : ''}
        </div>
        <div class="text-right">
          <p class="font-bold text-lg text-green-600">${order.total} บาท</p>
          <span class="inline-block px-3 py-1 text-sm rounded-full bg-green-100 text-green-800 font-semibold">
            <i class="fas fa-check-circle mr-1"></i>เสิร์ฟแล้ว
          </span>
        </div>
      </div>
      <div class="border-t pt-3 mb-3">
        <h5 class="font-semibold mb-2">รายการอาหาร:</h5>
        <div class="space-y-1">
          ${order.items.map(item => `
            <div class="flex justify-between text-sm">
              <span>${item.name} x${item.quantity}</span>
              <span>${item.price * item.quantity} บาท</span>
            </div>
          `).join('')}
        </div>
      </div>
      <div class="bg-yellow-50 border border-yellow-200 p-3 rounded mb-3">
        <h5 class="font-semibold mb-2 text-yellow-800"><i class="fas fa-clock mr-2"></i>รอชำระเงิน</h5>
        <div class="grid grid-cols-2 gap-2 text-sm">
          <div>ราคารวม: <span class="font-bold">${order.total} บาท</span></div>
          <div>ส่วนลด: <span class="font-bold">0 บาท</span></div>
          ${order.servedAt ? `<div class=\"col-span-2 text-xs text-gray-600 mt-1\">เสิร์ฟเมื่อ: ${new Date(order.servedAt).toLocaleString('th-TH')}</div>` : ''}
        </div>
      </div>
      <div class="flex space-x-2">
        <button onclick="processPayment('${order.id}', 'cash')" class="flex-1 bg-green-500 text-white py-2 px-4 rounded hover:bg-green-600 font-semibold"><i class="fas fa-money-bill mr-2"></i>เงินสด</button>
        <button onclick="processPayment('${order.id}', 'card')" class="flex-1 bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 font-semibold"><i class="fas fa-credit-card mr-2"></i>บัตร</button>
        <button onclick="processPayment('${order.id}', 'transfer')" class="flex-1 bg-purple-500 text-white py-2 px-4 rounded hover:bg-purple-600 font-semibold"><i class="fas fa-mobile-alt mr-2"></i>โอน</button>
      </div>
    </div>
  `).join('');
}

function showStaffHistory(period) {
  document.querySelectorAll('.history-tab-btn').forEach(btn => {
    btn.classList.remove('active', 'bg-blue-500', 'text-white');
    btn.classList.add('bg-gray-200', 'text-gray-700');
  });
  const activeTab = document.getElementById(`${period}Tab`);
  if (activeTab) {
    activeTab.classList.add('active', 'bg-blue-500', 'text-white');
    activeTab.classList.remove('bg-gray-200', 'text-gray-700');
  }
  loadStaffHistory(period);
}

function loadStaffHistory(period) {
  const completedOrders = orders.filter(order => order.status === 'completed');
  const today = new Date();
  let filteredOrders = [];
  switch(period) {
    case 'day':
      filteredOrders = completedOrders.filter(order => new Date(order.timestamp).toDateString() === today.toDateString());
      break;
    case 'week':
      const weekStart = new Date(today); weekStart.setDate(today.getDate() - today.getDay());
      filteredOrders = completedOrders.filter(order => new Date(order.timestamp) >= weekStart);
      break;
    case 'month':
      filteredOrders = completedOrders.filter(order => { const d = new Date(order.timestamp); return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear(); });
      break;
    case 'year':
      filteredOrders = completedOrders.filter(order => new Date(order.timestamp).getFullYear() === today.getFullYear());
      break;
  }
  const totalOrders = filteredOrders.length;
  const totalSales = filteredOrders.reduce((sum, order) => sum + order.total, 0);
  const avgOrders = period === 'day' ? totalOrders : Math.round(totalOrders / getDaysInPeriod(period));
  const servedOrders = filteredOrders.filter(order => order.servedBy).length;
  const historyTotalOrders = document.getElementById('historyTotalOrders');
  const historyTotalSales = document.getElementById('historyTotalSales');
  const historyAvgOrders = document.getElementById('historyAvgOrders');
  const historyServedOrders = document.getElementById('historyServedOrders');
  if (historyTotalOrders) historyTotalOrders.textContent = totalOrders;
  if (historyTotalSales) historyTotalSales.textContent = totalSales.toLocaleString() + ' บาท';
  if (historyAvgOrders) historyAvgOrders.textContent = avgOrders;
  if (historyServedOrders) historyServedOrders.textContent = servedOrders;
  const historyList = document.getElementById('staffHistoryList');
  if (!historyList) return;
  if (filteredOrders.length === 0) {
    historyList.innerHTML = '<p class="text-gray-500 text-center py-8">ไม่มีข้อมูลออเดอร์ในช่วงเวลานี้</p>';
    return;
  }
  historyList.innerHTML = filteredOrders.slice(0, 20).map(order => `
    <div class="border rounded-lg p-3 bg-white hover:bg-gray-50">
      <div class="flex justify-between items-center">
        <div>
          <h5 class="font-bold">#${order.id}</h5>
          <p class="text-sm text-gray-600">${order.customerName || 'ลูกค้าทั่วไป'}</p>
          <p class="text-xs text-gray-500">${new Date(order.timestamp).toLocaleString('th-TH')}</p>
        </div>
        <div class="text-right">
          <p class="font-bold text-green-600">${order.total} บาท</p>
          <p class="text-xs text-gray-500">${order.paymentMethod || 'เงินสด'}</p>
        </div>
      </div>
    </div>
  `).join('');
}

function loadStaffStatsSection() {
  const today = new Date();
  const todayStart = new Date(today.setHours(0,0,0,0));
  const myOrdersToday = orders.filter(order => {
    const orderDate = new Date(order.timestamp);
    return orderDate >= todayStart && (order.servedBy === currentUser?.username || order.processedBy === currentUser?.username);
  });
  const myServed = myOrdersToday.filter(o => o.servedBy === currentUser?.username).length;
  const myPending = myOrdersToday.filter(o => o.status === 'served' && o.servedBy === currentUser?.username).length;
  const myCompleted = myOrdersToday.filter(o => o.status === 'completed' && o.processedBy === currentUser?.username).length;
  const myTotalSales = myOrdersToday.filter(o => o.status === 'completed' && o.processedBy === currentUser?.username).reduce((sum, o) => sum + o.total, 0);
  const myAvg = myCompleted > 0 ? Math.round(myTotalSales / myCompleted) : 0;
  const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setText('myOrdersServed', myServed);
  setText('myPendingPayments', myPending);
  setText('myCompletedPayments', myCompleted);
  setText('myTotalSales', myTotalSales.toLocaleString());
  setText('myAvgOrderValue', myAvg.toLocaleString());
  const allOrdersToday = orders.filter(order => new Date(order.timestamp) >= todayStart);
  const teamServed = allOrdersToday.filter(o => o.status === 'served' || o.status === 'delivered' || o.status === 'completed').length;
  const teamPending = allOrdersToday.filter(o => o.status === 'served' || o.status === 'delivered').length;
  const teamCompleted = allOrdersToday.filter(o => o.status === 'completed').length;
  const teamTotalSales = allOrdersToday.filter(o => o.status === 'completed').reduce((sum, o) => sum + o.total, 0);
  const staffWorking = new Set();
  allOrdersToday.forEach(o => { if (o.servedBy) staffWorking.add(o.servedBy); if (o.processedBy) staffWorking.add(o.processedBy); });
  setText('teamOrdersServed', teamServed);
  setText('teamPendingPayments', teamPending);
  setText('teamCompletedPayments', teamCompleted);
  setText('teamTotalSales', teamTotalSales.toLocaleString());
  setText('teamStaffCount', staffWorking.size);
  createStaffCharts(myOrdersToday, allOrdersToday);
}

function createStaffCharts(myOrders, teamOrders) {
  const last7Days = [];
  const myDailyOrders = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    date.setHours(0,0,0,0);
    const nextDate = new Date(date); nextDate.setDate(nextDate.getDate() + 1);
    last7Days.push(date.toLocaleDateString('th-TH', {day: 'numeric', month: 'short'}));
    const dayOrders = orders.filter(o => {
      const d = new Date(o.timestamp);
      return d >= date && d < nextDate && (o.servedBy === currentUser?.username || o.processedBy === currentUser?.username);
    }).length;
    myDailyOrders.push(dayOrders);
  }
  const myPerfCtx = document.getElementById('myPerformanceChart');
  if (myPerfCtx) {
    if (staffCharts.myPerf) staffCharts.myPerf.destroy();
    staffCharts.myPerf = new Chart(myPerfCtx, {
      type: 'line',
      data: { labels: last7Days, datasets: [{ label: 'ออเดอร์ที่จัดการ', data: myDailyOrders, borderColor: 'rgb(59, 130, 246)', backgroundColor: 'rgba(59, 130, 246, 0.1)', tension: 0.4, fill: true }]},
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true } } }
    });
  }
  const paymentMethods = { cash: 0, card: 0, transfer: 0 };
  myOrders.filter(o => o.status === 'completed' && o.paymentMethod).forEach(o => { paymentMethods[o.paymentMethod] = (paymentMethods[o.paymentMethod] || 0) + 1; });
  const myPayCtx = document.getElementById('myPaymentChart');
  if (myPayCtx) {
    if (staffCharts.myPay) staffCharts.myPay.destroy();
    staffCharts.myPay = new Chart(myPayCtx, { type: 'doughnut', data: { labels: ['เงินสด', 'บัตร', 'โอนเงิน'], datasets: [{ data: [paymentMethods.cash, paymentMethods.card, paymentMethods.transfer], backgroundColor: ['#10b981', '#3b82f6', '#8b5cf6'] }]}, options: { responsive: true, maintainAspectRatio: false } });
  }
  const teamDailySales = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    date.setHours(0,0,0,0);
    const nextDate = new Date(date); nextDate.setDate(nextDate.getDate() + 1);
    const daySales = orders.filter(o => { const d = new Date(o.timestamp); return d >= date && d < nextDate && o.status === 'completed'; }).reduce((sum, o) => sum + o.total, 0);
    teamDailySales.push(daySales);
  }
  const teamSalesCtx = document.getElementById('teamSalesChart');
  if (teamSalesCtx) {
    if (staffCharts.teamSales) staffCharts.teamSales.destroy();
    staffCharts.teamSales = new Chart(teamSalesCtx, { type: 'bar', data: { labels: last7Days, datasets: [{ label: 'ยอดขาย (บาท)', data: teamDailySales, backgroundColor: 'rgba(139, 92, 246, 0.7)', borderColor: 'rgb(139, 92, 246)', borderWidth: 1 }]}, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true } }, scales: { y: { beginAtZero: true } } } });
  }
  const today = new Date(); today.setHours(0,0,0,0);
  const todayOrders = orders.filter(o => new Date(o.timestamp) >= today);
  const perf = {};
  todayOrders.forEach(o => { if (o.servedBy) perf[o.servedBy] = (perf[o.servedBy] || 0) + 1; if (o.processedBy && o.processedBy !== o.servedBy) perf[o.processedBy] = (perf[o.processedBy] || 0) + 1; });
  const names = Object.keys(perf); const counts = Object.values(perf);
  const teamPerfCtx = document.getElementById('teamPerformanceChart');
  if (teamPerfCtx) {
    if (staffCharts.teamPerf) staffCharts.teamPerf.destroy();
    staffCharts.teamPerf = new Chart(teamPerfCtx, { type: 'bar', data: { labels: names, datasets: [{ label: 'ออเดอร์ที่จัดการ', data: counts, backgroundColor: 'rgba(34, 197, 94, 0.7)', borderColor: 'rgb(34, 197, 94)', borderWidth: 1 }]}, options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true } } } });
  }
}

function serveOrderNew(orderId) {
  const order = orders.find(o => o.id === orderId);
  if (order) {
    const oldStatus = order.status;
    order.status = order.type === 'dine-in' ? 'served' : 'delivered';
    order.servedBy = currentUser?.username || 'พนักงาน';
    order.servedAt = new Date().toISOString();
    saveOrders();
    loadStaffOrdersSection();
    loadStaffPayments();
    showNotification('เสิร์ฟออเดอร์เรียบร้อยแล้ว', 'success');
  }
}

function processPayment(orderId, method) {
  const order = orders.find(o => o.id === orderId);
  if (order) {
    order.status = 'completed';
    order.paymentMethod = method;
    order.paymentStatus = 'paid';
    order.paidAt = new Date().toISOString();
    order.processedBy = currentUser?.username || 'พนักงาน';
    saveOrders();
    loadStaffPayments();
    loadStaffHistory('day');
    showNotification(`ชำระเงินด้วย${getPaymentMethodName(method)}เรียบร้อยแล้ว`, 'success');
  }
}

function getPaymentMethodName(method) {
  const methods = { 'cash': 'เงินสด', 'card': 'บัตร', 'transfer': 'โอนเงิน' };
  return methods[method] || method;
}

function getDaysInPeriod(period) {
  const today = new Date();
  switch(period) { case 'week': return 7; case 'month': return new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate(); case 'year': return 365; default: return 1; }
}

function printDailyReport() {
  showNotification('กำลังเตรียมรายงานประจำวัน...', 'info');
  setTimeout(() => { showNotification('พิมพ์รายงานเรียบร้อยแล้ว', 'success'); }, 2000);
}

function viewOrderDetails(orderId) {
  const order = orders.find(o => o.id === orderId);
  if (order) {
  const typeLabel = order.type === 'dine-in' ? 'ทานที่ร้าน' : (order.type === 'delivery' ? 'เดลิเวอรี่' : 'สั่งกลับบ้าน');
  alert(`รายละเอียดออเดอร์ #${order.id}\n\nลูกค้า: ${order.customerName || 'ลูกค้าทั่วไป'}\nประเภท: ${typeLabel}\nยอดรวม: ${order.total} บาท\nสถานะ: ${order.status}`);
  }
}

// Export to global for HTML inline handlers
Object.assign(window, {
  confirmStaffPayment,
  loadStaffOrders,
  serveOrder,
  assignToRider,
  loadStaffStats,
  showStaffSection,
  loadStaffOrdersSection,
  loadStaffPayments,
  showStaffHistory,
  loadStaffHistory,
  loadStaffStatsSection,
  createStaffCharts,
  serveOrderNew,
  processPayment,
  getPaymentMethodName,
  getDaysInPeriod,
  printDailyReport,
  viewOrderDetails,
  staffCharts
});
