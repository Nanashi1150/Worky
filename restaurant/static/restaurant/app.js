// App State
let currentRole = null;
let cart = [];
let favorites = [];
let orders = [];
let menuItems = [];
let ingredients = [];
let users = [];
let systemLogs = [];
let allData = [];
let vouchers = [];
let selectedVoucherCode = null;
// Charts holder for Admin reports
let adminCharts = {};

// Global state variables for staff workflow
let currentUser = null;
let foodSets = [];
let discounts = { menuItems: {}, sets: {} };

// Default configuration
const defaultConfig = {
  restaurant_name: 'ร้านอาหารดีลิเชียส',
  restaurant_phone: '02-123-4567',
  delivery_fee: '30',
  hero_image_url: 'https://images.unsplash.com/photo-1559314809-0f31657def5e?w=1000',
};

// Placeholder food image used when a menu image is missing or fails to load
const PLACEHOLDER_FOOD = 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&auto=format&fit=crop&q=60';
// Backward-compatible alias
const PLACEHOLDER_IMAGE = PLACEHOLDER_FOOD;
// Fallback SVG if network image fails as well
const PLACEHOLDER_SVG =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#fef3c7"/>
          <stop offset="100%" stop-color="#fde68a"/>
        </linearGradient>
      </defs>
      <rect fill="url(#g)" width="100%" height="100%"/>
      <g>
        <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#92400e" font-family="Arial, sans-serif" font-size="18">อร่อยพร้อมเสิร์ฟ</text>
      </g>
    </svg>`
  );

function setPlaceholderImg(img, altText) {
  try {
    if (!img) return;
    // First try a pleasant food photo; if that fails, fallback to inline SVG
    img.onerror = function () {
      img.onerror = null;
      img.src = PLACEHOLDER_SVG;
    };
    img.src = PLACEHOLDER_FOOD;
    if (altText) img.alt = altText;
    img.style.display = 'block';
  } catch (_) {}
}

// Data SDK handler (safe no-op when SDK missing)
const dataHandler = {
  onDataChanged(data) {
    try {
      allData = Array.isArray(data) ? data : [];
    } catch (e) {
      console.warn('onDataChanged error:', e);
    }
  },
};

// Element SDK configuration (safe no-op when SDK missing)
const elementConfig = {
  defaultConfig: defaultConfig,
  render: async (config) => {
    try {
      const navName = document.getElementById('navRestaurantName');
      if (navName) {
        navName.textContent = (config && config.restaurant_name) || defaultConfig.restaurant_name;
      }
      // Sync hero image from config
      setHeroImageFromConfig(config);
      // Prefill admin settings input if present
      const heroInput = document.getElementById('heroImageUrl');
      if (heroInput) heroInput.value = (config && config.hero_image_url) || defaultConfig.hero_image_url || '';
      updateCartTotal();
    } catch (e) {}
  },
  mapToCapabilities: (config) => ({
    recolorables: [],
    borderables: [],
  }),
  mapToEditPanelValues: (config) => new Map([
    ['restaurant_name', (config && config.restaurant_name) || defaultConfig.restaurant_name],
    ['restaurant_phone', (config && config.restaurant_phone) || defaultConfig.restaurant_phone],
    ['delivery_fee', (config && config.delivery_fee) || defaultConfig.delivery_fee],
    ['hero_image_url', (config && config.hero_image_url) || defaultConfig.hero_image_url],
  ]),
};

async function initializeApp() {
  try {
    if (window.dataSdk && typeof window.dataSdk.init === 'function') {
      await window.dataSdk.init(dataHandler);
    }
    if (window.elementSdk && typeof window.elementSdk.init === 'function') {
      await window.elementSdk.init(elementConfig);
    }
    // Load persisted favorites/cart before bootstrapping demo data/UI
    loadPersistedData();
    initializeDemoData();
    setupEventListeners();
    // Default recommended list to popular first
    try { if (typeof window.renderRecommended === 'function') window.renderRecommended('best'); } catch (_) {}
  // Ensure hero image set even if elementSdk not available
  setHeroImageFromConfig(window.elementSdk && window.elementSdk.config ? window.elementSdk.config : null);

    // Always show login (auth modal) when rendering home.html; a separate login page is the entry point.
    // Auto-login via localStorage has been disabled by requirement.

    // If server-side session exists, use it; no more demo auto-login
    if (window.currentUser && window.currentUser.role) {
      loginUser({
        name: window.currentUser.name || window.currentUser.username,
        username: window.currentUser.username,
        email: window.currentUser.email,
        role: window.currentUser.role,
      });
    }
  } catch (error) {
    console.error('App initialization error:', error);
  }
}

// Minimal backend adapter when no external data SDK is provided
// Provides create() for 'order' to persist server-side and init() to optionally sync user orders.
if (!window.dataSdk) {
  function getCsrfToken() {
    try {
      return document.cookie.split(';').map(s => s.trim()).find(s => s.startsWith('csrftoken='))?.split('=')[1] || '';
    } catch (_) { return ''; }
  }
  window.dataSdk = {
    async init(handler) {
      try {
        // Optionally, load recent orders to hydrate client UI
        const res = await fetch('/api/orders/my', { credentials: 'same-origin' });
        if (res.ok) {
          const j = await res.json();
          if (Array.isArray(j.orders)) {
            // Do not replace local orders if you have existing state; this is a light sync.
            // You can map these into the UI as needed.
          }
        }
        if (handler && typeof handler.onDataChanged === 'function') handler.onDataChanged([]);
      } catch (_) {}
    },
    async create(payload) {
      try {
        if (payload && payload.type === 'order') {
          let body;
          if (payload.data) {
            body = JSON.parse(payload.data);
          } else if (payload.order) {
            body = payload.order;
          } else {
            return { isOk: false };
          }
          const res = await fetch('/api/orders/', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfToken() },
            body: JSON.stringify(body),
          });
          return { isOk: res.ok };
        }
        return { isOk: false };
      } catch (e) {
        console.error('dataSdk.create error:', e);
        return { isOk: false };
      }
    }
  };
}

// Persistence helpers
const STORAGE_KEYS = {
  // Base prefixes (scoped keys are computed via helpers below)
  cartPrefix: 'restaurant_cart',
  favoritesPrefix: 'restaurant_favorites',
  menuItems: 'restaurant_menu_items',
  ingredients: 'restaurant_ingredients',
  sets: 'restaurant_sets',
  discounts: 'restaurant_discounts',
  vouchers: 'restaurant_vouchers',
  selectedVoucher: 'restaurant_selected_voucher',
  users: 'restaurant_users',
  currentUser: 'restaurant_current_user',
  orders: 'restaurant_orders',
};

// Compute per-user storage scope so demo accounts and real accounts do not share carts/favorites
function getStorageScope() {
  try {
    // Prefer server-injected user when available
    if (window.currentUser && window.currentUser.username) {
      const u = window.currentUser.username;
      if (u.startsWith('demo_')) return `demo:${u}`;
      return `user:${u}`;
    }
    // Fallback to locally persisted user info
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.currentUser) || 'null');
    if (saved && saved.username) {
      const u = saved.username;
      if (u.startsWith('demo_')) return `demo:${u}`;
      return `user:${u}`;
    }
  } catch (_) {}
  return 'guest';
}

function getCartKey() { return `${STORAGE_KEYS.cartPrefix}:${getStorageScope()}`; }
function getFavoritesKey() { return `${STORAGE_KEYS.favoritesPrefix}:${getStorageScope()}`; }

function saveCart() {
  try { localStorage.setItem(getCartKey(), JSON.stringify(cart)); } catch (_) {}
}
function saveFavorites() {
  try { localStorage.setItem(getFavoritesKey(), JSON.stringify(favorites)); } catch (_) {}
}
function saveUsers() {
  try { localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(users)); } catch (_) {}
}
function saveCurrentUser() {
  try { localStorage.setItem(STORAGE_KEYS.currentUser, JSON.stringify(currentUser || null)); } catch (_) {}
}

function saveMenuItems() {
  try { localStorage.setItem(STORAGE_KEYS.menuItems, JSON.stringify(menuItems || [])); } catch (_) {}
}

function saveIngredients() {
  try { localStorage.setItem(STORAGE_KEYS.ingredients, JSON.stringify(ingredients || [])); } catch (_) {}
}

// Persist orders to localStorage
function saveOrders() {
  try { localStorage.setItem(STORAGE_KEYS.orders, JSON.stringify(orders || [])); } catch (_) {}
}

// Load persisted state from localStorage (cart, favorites, users, currentUser, orders, sets, discounts, vouchers)
function loadPersistedData() {
  try {
    const savedCart = JSON.parse(localStorage.getItem(getCartKey()) || '[]');
    if (Array.isArray(savedCart)) cart = savedCart;
  } catch (_) {}
  try {
    const savedFav = JSON.parse(localStorage.getItem(getFavoritesKey()) || '[]');
    if (Array.isArray(savedFav)) favorites = savedFav;
  } catch (_) {}
  try {
    const savedMenu = JSON.parse(localStorage.getItem(STORAGE_KEYS.menuItems) || '[]');
    if (Array.isArray(savedMenu)) menuItems = savedMenu;
  } catch (_) {}
  try {
    const savedIngredients = JSON.parse(localStorage.getItem(STORAGE_KEYS.ingredients) || '[]');
    if (Array.isArray(savedIngredients)) ingredients = savedIngredients;
  } catch (_) {}
  try {
    const savedUsers = JSON.parse(localStorage.getItem(STORAGE_KEYS.users) || '[]');
    if (Array.isArray(savedUsers)) users = savedUsers;
  } catch (_) {}
  try {
    const savedCurrentUser = JSON.parse(localStorage.getItem(STORAGE_KEYS.currentUser) || 'null');
    if (savedCurrentUser) {
      currentUser = savedCurrentUser;
      currentRole = savedCurrentUser.role;
    }
  } catch (_) {}
  try {
    const savedOrders = JSON.parse(localStorage.getItem(STORAGE_KEYS.orders) || '[]');
    if (Array.isArray(savedOrders)) orders = savedOrders;
  } catch (_) {}
  try {
    const savedSets = JSON.parse(localStorage.getItem(STORAGE_KEYS.sets) || '[]');
    if (Array.isArray(savedSets)) foodSets = savedSets;
  } catch (_) {}
  try {
    const savedDiscounts = JSON.parse(localStorage.getItem(STORAGE_KEYS.discounts) || '{}');
    if (savedDiscounts && typeof savedDiscounts === 'object') discounts = savedDiscounts;
  } catch (_) {}
  try {
    const savedVouchers = JSON.parse(localStorage.getItem(STORAGE_KEYS.vouchers) || '[]');
    if (Array.isArray(savedVouchers)) vouchers = savedVouchers;
  } catch (_) {}
  try {
    selectedVoucherCode = localStorage.getItem(STORAGE_KEYS.selectedVoucher) || null;
  } catch (_) {}
}

// Demo data initializer (kept minimal after modularization)
function initializeDemoData() {
  // Build a rich seed list (~30 items). Append only missing ids; never overwrite existing.
  const seedMenu = [
    { id: 'menu_padthai', name: 'ผัดไทยกุ้งสด', category: 'main', price: 120, description: 'เส้นเหนียวนุ่ม ซอสเข้มข้น พร้อมกุ้งสดตัวโต', image: 'https://images.unsplash.com/photo-1604908176997-4319c03f2cfb?w=800', available: true, featured: true, ingredientsUsage: { ing_shrimp: 0.12, ing_noodle: 0.18, ing_tamarind: 0.03, ing_fishsauce: 0.02, ing_palm_sugar: 0.02 } },
    { id: 'menu_tomyum', name: 'ต้มยำกุ้ง', category: 'main', price: 150, description: 'ต้มยำกุ้งรสจัดจ้าน หอมสมุนไพร', image: 'https://images.unsplash.com/photo-1569562211093-4ed0d0758f12?w=800', available: true, featured: true, ingredientsUsage: { ing_shrimp: 0.15 } },
    { id: 'menu_somtam', name: 'ส้มตำไทย', category: 'appetizer', price: 80, description: 'ส้มตำไทยรสชาติดั้งเดิม เผ็ดหวานกลมกล่อม', image: 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=800', available: true, featured: true, ingredientsUsage: {} },
    { id: 'menu_friedrice', name: 'ข้าวผัดกุ้ง', category: 'main', price: 100, description: 'ข้าวผัดหอมกระทะ กุ้งเด้ง ใส่ไข่ดาว', image: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800', available: true, featured: false, ingredientsUsage: { ing_shrimp: 0.12 } },
    { id: 'menu_mango', name: 'ข้าวเหนียวมะม่วง', category: 'dessert', price: 65, description: 'มะม่วงสุกหวาน ข้าวเหนียวมันกะทิ', image: 'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=800', available: true, featured: false, ingredientsUsage: {} },
    { id: 'menu_thaitea', name: 'ชาไทยเย็น', category: 'beverage', price: 40, description: 'ชาไทยเข้ม หวานมัน เย็นชื่นใจ', image: 'https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=800', available: true, featured: false, ingredientsUsage: {} },
    { id: 'menu_krapao_pork', name: 'กะเพราหมูกรอบ', category: 'main', price: 95, description: 'เผ็ดหอมกะเพรา หมูกรอบชิ้นโต', image: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800', available: true, featured: true, ingredientsUsage: {} },
    { id: 'menu_krapao_chicken', name: 'กะเพราไก่ไข่ดาว', category: 'main', price: 85, description: 'ไก่สับผัดกะเพรา ราดข้าว ไข่ดาวกรอบ', image: 'https://images.unsplash.com/photo-1526312426976-593c5cfedb30?w=800', available: true, featured: false, ingredientsUsage: {} },
    { id: 'menu_green_curry', name: 'แกงเขียวหวานไก่', category: 'main', price: 120, description: 'เข้มข้นหอมใบโหระพา เสิร์ฟพร้อมข้าวสวย', image: 'https://images.unsplash.com/photo-1551892374-ecf8754cf8f2?w=800', available: true, featured: false, ingredientsUsage: {} },
    { id: 'menu_red_curry', name: 'แกงเผ็ดหมู', category: 'main', price: 120, description: 'เผ็ดกลมกล่อม หอมเครื่องแกง', image: 'https://images.unsplash.com/photo-1559639190-9f6a1f2a0cf5?w=800', available: true, featured: false, ingredientsUsage: {} },
    { id: 'menu_massaman', name: 'แกงมัสมั่นเนื้อ', category: 'main', price: 180, description: 'มันฝรั่ง ถั่วลิสง ซอสเข้มข้น', image: 'https://images.unsplash.com/photo-1617191519400-8cc6f0907561?w=800', available: true, featured: true, ingredientsUsage: {} },
    { id: 'menu_panang', name: 'พะแนงไก่', category: 'main', price: 120, description: 'กะทิเข้มข้น หอมพริกแกงพะแนง', image: 'https://images.unsplash.com/photo-1617196034370-7fcd4e70e27b?w=800', available: true, featured: false, ingredientsUsage: {} },
    { id: 'menu_yentafo', name: 'เย็นตาโฟ', category: 'main', price: 80, description: 'เส้นเหนียวนุ่ม น้ำซุปเข้ม รสกลมกล่อม', image: 'https://images.unsplash.com/photo-1599351430140-6f7c30a54796?w=800', available: true, featured: false, ingredientsUsage: {} },
    { id: 'menu_tomyum_noodle', name: 'บะหมี่ต้มยำ', category: 'main', price: 85, description: 'เครื่องแน่น รสแซ่บกำลังดี', image: 'https://images.unsplash.com/photo-1544025161-197949b0164a?w=800', available: true, featured: false, ingredientsUsage: {} },
    { id: 'menu_khao_mok_gai', name: 'ข้าวหมกไก่', category: 'main', price: 95, description: 'ข้าวหอมเครื่องเทศ ไก่นุ่ม', image: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=800', available: true, featured: false, ingredientsUsage: {} },
    { id: 'menu_khao_moo_daeng', name: 'ข้าวหมูแดง', category: 'main', price: 85, description: 'หมูแดงน้ำราดเข้มข้น ไข่ต้ม', image: 'https://images.unsplash.com/photo-1573408301185-cb3a9a1466c3?w=800', available: true, featured: false, ingredientsUsage: {} },
    { id: 'menu_khao_kha_mu', name: 'ข้าวขาหมู', category: 'main', price: 95, description: 'ขาหมูนุ่ม หนังเด้ง เสิร์ฟพร้อมผักดอง', image: 'https://images.unsplash.com/photo-1585034366480-7f6a1d3e41b0?w=800', available: true, featured: false, ingredientsUsage: {} },
    { id: 'menu_moo_satay', name: 'หมูสะเต๊ะ', category: 'appetizer', price: 85, description: 'หมูนุ่มไม้โต น้ำจิ้มถั่วเข้มข้น', image: 'https://images.unsplash.com/photo-1553621042-f6e147245754?w=800', available: true, featured: false, ingredientsUsage: {} },
    { id: 'menu_spring_rolls', name: 'ปอเปี๊ยะทอด', category: 'appetizer', price: 75, description: 'กรอบนอก นุ่มใน จิ้มบ๊วย', image: 'https://images.unsplash.com/photo-1601050690299-44aa5a5a60a7?w=800', available: true, featured: false, ingredientsUsage: {} },
    { id: 'menu_larb_moo', name: 'ลาบหมู', category: 'appetizer', price: 95, description: 'เผ็ดเปรี้ยวหอมข้าวคั่ว', image: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800', available: true, featured: false, ingredientsUsage: {} },
    { id: 'menu_nam_tok', name: 'น้ำตกหมู', category: 'appetizer', price: 95, description: 'หมูย่างหั่นชิ้น คลุกเครื่องสมุนไพร', image: 'https://images.unsplash.com/photo-1625944381008-0a5f87bbba66?w=800', available: true, featured: false, ingredientsUsage: {} },
    { id: 'menu_tod_mun', name: 'ทอดมันปลา', category: 'appetizer', price: 85, description: 'หอมพริกแกง กรอบร้อน', image: 'https://images.unsplash.com/photo-1604908554048-502a2b775734?w=800', available: true, featured: false, ingredientsUsage: {} },
    { id: 'menu_wonton_soup', name: 'เกี๊วน้ำกุ้ง', category: 'main', price: 85, description: 'น้ำซุปหวานหอม เกี๊วกุ้งชิ้นโต', image: 'https://images.unsplash.com/photo-1604908554182-023cc42f5a93?w=800', available: true, featured: false, ingredientsUsage: {} },
    { id: 'menu_clear_pork_soup', name: 'ต้มจืดเต้าหู้หมูสับ', category: 'main', price: 80, description: 'ซุปใสคล่องคอ เต้าหู้นิ่ม', image: 'https://images.unsplash.com/photo-1572441710519-8ce7d89f2c6d?w=800', available: true, featured: false, ingredientsUsage: {} },
    { id: 'menu_omelette_rice', name: 'ข้าวไข่เจียวหมูสับ', category: 'main', price: 75, description: 'ไข่ฟูกรอบ หมูสับรสกลมกล่อม', image: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=800', available: true, featured: false, ingredientsUsage: {} },
    { id: 'menu_bua_loi', name: 'บัวลอย', category: 'dessert', price: 45, description: 'แป้งหนึบหนับ น้ำกะทิหอม', image: 'https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?w=800', available: true, featured: false, ingredientsUsage: {} },
    { id: 'menu_lodchong', name: 'ลอดช่อง', category: 'dessert', price: 45, description: 'หวานหอม คลายร้อน', image: 'https://images.unsplash.com/photo-1589308078055-53039b072dea?w=800', available: true, featured: false, ingredientsUsage: {} },
    { id: 'menu_mango_smoothie', name: 'สมูทตี้มะม่วง', category: 'beverage', price: 55, description: 'เนื้อมะม่วงเน้นๆ เย็นสดชื่น', image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800', available: true, featured: false, ingredientsUsage: {} },
    { id: 'menu_coconut_icecream', name: 'ไอศกรีมกะทิ', category: 'dessert', price: 49, description: 'กะทิหอม มะพร้าวกรุบกรอบ', image: 'https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?w=800', available: true, featured: false, ingredientsUsage: {} },
    { id: 'menu_milk_tea', name: 'ชานม', category: 'beverage', price: 45, description: 'หอมชา นมละมุน', image: 'https://images.unsplash.com/photo-1517705008128-361805f42e86?w=800', available: true, featured: false, ingredientsUsage: {} },
    { id: 'menu_lemongrass', name: 'น้ำตะไคร้เย็น', category: 'beverage', price: 35, description: 'หอมสมุนไพร ดื่มแล้วสดชื่น', image: 'https://images.unsplash.com/photo-1551024709-8f23befc6cf7?w=800', available: true, featured: false, ingredientsUsage: {} },
    { id: 'menu_pandan', name: 'น้ำใบเตยเย็น', category: 'beverage', price: 35, description: 'หวานหอมธรรมชาติ', image: 'https://images.unsplash.com/photo-1542444459-db63c0d537a6?w=800', available: true, featured: false, ingredientsUsage: {} },
  ];

  if (!Array.isArray(menuItems)) menuItems = [];
  const existing = new Set(menuItems.map((m) => m.id));
  const toAdd = seedMenu.filter((m) => !existing.has(m.id));
  if (toAdd.length) {
    const now = Date.now();
    const withCreated = toAdd.map((m, i) => ({ ...m, createdAt: m.createdAt || new Date(now - i * 60000).toISOString() }));
    menuItems = menuItems.concat(withCreated);
    saveMenuItems();
  }

  if (!Array.isArray(ingredients) || ingredients.length === 0) {
    ingredients = [
      { id: 'ing_shrimp', name: 'กุ้งสด', stock: 50, unit: 'กิโลกรัม', minStock: 10 },
      { id: 'ing_noodle', name: 'เส้นผัดไทย', stock: 20, unit: 'แพ็ค', minStock: 5 },
      { id: 'ing_tamarind', name: 'มะขามเปียก', stock: 15, unit: 'กิโลกรัม', minStock: 3 },
      { id: 'ing_palm_sugar', name: 'น้ำตาลปี๊บ', stock: 8, unit: 'กิโลกรัม', minStock: 2 },
      { id: 'ing_fishsauce', name: 'น้ำปลา', stock: 25, unit: 'ขวด', minStock: 5 },
    ];
    saveIngredients();
  }

  // Refresh relevant UIs
  try { loadChefMenu(); } catch (_) {}
  try { loadInventory(); } catch (_) {}
  try { loadAdminMenu(); } catch (_) {}
  try { if (typeof window.loadMenuGrid === 'function') window.loadMenuGrid(); } catch (_) {}
  try { if (typeof window.loadFeaturedMenu === 'function') window.loadFeaturedMenu(); } catch (_) {}
}

function setupEventListeners() {
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const addMenuForm = document.getElementById('addMenuForm');

  if (loginForm) loginForm.addEventListener('submit', (e) => { e.preventDefault(); if (typeof window.handleLogin === 'function') window.handleLogin(e); });
  if (registerForm) registerForm.addEventListener('submit', (e) => { e.preventDefault(); if (typeof window.handleRegister === 'function') window.handleRegister(e); });
  if (addMenuForm) addMenuForm.addEventListener('submit', handleAddMenu);

  const loginTab = document.getElementById('loginTab');
  const registerTab = document.getElementById('registerTab');
  if (loginTab) loginTab.addEventListener('click', () => switchAuthTab('login'));
  if (registerTab) registerTab.addEventListener('click', () => switchAuthTab('register'));

  const menuSearch = document.getElementById('menuSearch');
  const categoryFilter = document.getElementById('categoryFilter');
  if (menuSearch) menuSearch.addEventListener('input', () => { if (typeof window.loadMenuGrid === 'function') window.loadMenuGrid(); });
  if (categoryFilter) categoryFilter.addEventListener('change', () => { if (typeof window.loadMenuGrid === 'function') window.loadMenuGrid(); });

  // Recommended tabs
  const tabBest = document.getElementById('tabBest');
  const tabValue = document.getElementById('tabValue');
  if (tabBest) tabBest.addEventListener('click', () => switchRecommended('best'));
  if (tabValue) tabValue.addEventListener('click', () => switchRecommended('value'));

  // Payment/orderType controls
  const orderTypeSel = document.getElementById('orderType');
  if (orderTypeSel) orderTypeSel.addEventListener('change', () => { if (typeof window.renderPaymentSection === 'function') window.renderPaymentSection(); });
  const payCod = document.getElementById('payCod');
  const payQr = document.getElementById('payQr');
  const payStaff = document.getElementById('payStaff');
  if (payCod) payCod.addEventListener('change', () => { if (typeof window.renderPaymentSection === 'function') window.renderPaymentSection(); });
  if (payQr) payQr.addEventListener('change', () => { if (typeof window.renderPaymentSection === 'function') window.renderPaymentSection(); });
  if (payStaff) payStaff.addEventListener('change', () => { if (typeof window.renderPaymentSection === 'function') window.renderPaymentSection(); });
  // Initialize payment section state
  if (typeof window.renderPaymentSection === 'function') window.renderPaymentSection();

  // Voucher select change handler
  const voucherSel = document.getElementById('voucherSelect');
  if (voucherSel) {
    voucherSel.addEventListener('change', () => {
      selectedVoucherCode = voucherSel.value || '';
      try { localStorage.setItem(STORAGE_KEYS.selectedVoucher, selectedVoucherCode || ''); } catch (_) {}
      if (typeof window.updateCartTotal === 'function') window.updateCartTotal();
    });
  }

  // QR Login role preview
  const qrRoleSel = document.getElementById('qrLoginRole');
  if (qrRoleSel) qrRoleSel.addEventListener('change', updateLoginQrPreview);
  updateLoginQrPreview();

  // Use current address toggle
  const useCurr = document.getElementById('useCurrentAddressOnly');
  if (useCurr) useCurr.addEventListener('change', toggleUseCurrentAddress);

  // Rider preference toggle
  initRiderAutoOpenToggle();

  // Profile image dropdown toggle
  const pimBtn = document.getElementById('profileImageMenuBtn');
  const pim = document.getElementById('profileImageMenu');
  if (pimBtn && pim) {
    pimBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      pim.classList.toggle('hidden');
    });
    document.addEventListener('click', () => pim.classList.add('hidden'));
  }
}

function switchAuthTab(tab) {
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const loginTab = document.getElementById('loginTab');
  const registerTab = document.getElementById('registerTab');

  if (tab === 'login') {
    if (loginForm) loginForm.classList.remove('hidden');
    if (registerForm) registerForm.classList.add('hidden');
    if (loginTab) {
      loginTab.classList.add('active', 'bg-blue-500', 'text-white');
      loginTab.classList.remove('bg-gray-200', 'text-gray-700');
    }
    if (registerTab) {
      registerTab.classList.remove('active', 'bg-blue-500', 'text-white');
      registerTab.classList.add('bg-gray-200', 'text-gray-700');
    }
  } else if (tab === 'register') {
    if (registerForm) registerForm.classList.remove('hidden');
    if (loginForm) loginForm.classList.add('hidden');
    if (registerTab) {
      registerTab.classList.add('active', 'bg-blue-500', 'text-white');
      registerTab.classList.remove('bg-gray-200', 'text-gray-700');
    }
    if (loginTab) {
      loginTab.classList.remove('active', 'bg-blue-500', 'text-white');
      loginTab.classList.add('bg-gray-200', 'text-gray-700');
    }
  }
}

// Recommended section
// moved to customer.js (recommended section UI)

function loadSystemData(data) {
  try {
    orders = data.filter((item) => item.type === 'order').map((item) => JSON.parse(item.data));
    if (currentRole) loadRoleData(currentRole);
  } catch (e) {
    // ignore
  }
}

// Auth
function quickLogin(role) {
  // Navigate to role-specific route to avoid ambiguity with /customer/
  try {
    window.location.href = `/${role}/`;
  } catch (_) {
    const demoUsers = {
      customer: { name: 'ลูกค้าทดสอบ', email: 'customer@demo.com', role: 'customer' },
      staff: { name: 'พนักงานทดสอบ', email: 'staff@demo.com', role: 'staff' },
      chef: { name: 'เชฟทดสอบ', email: 'chef@demo.com', role: 'chef' },
      rider: { name: 'ไรเดอร์ทดสอบ', email: 'rider@demo.com', role: 'rider' },
      admin: { name: 'แอดมินทดสอบ', email: 'admin@demo.com', role: 'admin' },
    };
    const user = demoUsers[role];
    if (user) loginUser(user);
  }
}

function loginUser(user) {
  currentUser = user;
  currentRole = user.role;
  
  // Save current user to localStorage
  saveCurrentUser();

  logAction('login', `${user.name || user.username} เข้าสู่ระบบ`);

  const authModal = document.getElementById('authModal');
  const app = document.getElementById('app');
  if (authModal) authModal.classList.add('hidden');
  if (app) app.classList.remove('hidden');
  // allow page scroll after closing modal
  document.body.classList.remove('modal-open');

  const userName = document.getElementById('userName');
  const userRole = document.getElementById('userRole');
  if (userName) userName.textContent = user.username || user.name;
  if (userRole) userRole.textContent = getRoleDisplayName(user.role);

  // Load avatar from storage into navbar
  try {
    const key = getProfileImageKey();
    const url = key ? localStorage.getItem(key) : null;
    setNavAvatarImage(url);
  } catch (_) {}

  showInterface(user.role);

  // Remove promo popup for now as requested
  // if (user.role === 'customer') {
  //   setTimeout(() => {
  //     const promo = document.getElementById('promotionModal');
  //     if (promo) promo.classList.remove('hidden');
  //   }, 500);
  // }
  
  showNotification('เข้าสู่ระบบสำเร็จ!', 'success');
}

function logout() {
  if (currentUser) logAction('logout', `${currentUser.name || currentUser.username} ออกจากระบบ`);
  currentUser = null;
  currentRole = null;
  cart = [];
  
  // Clear saved user from localStorage
  try { localStorage.removeItem(STORAGE_KEYS.currentUser); } catch (_) {}
  
  hideAllInterfaces();
  const app = document.getElementById('app');
  if (app) app.classList.add('hidden');
  showNotification('ออกจากระบบแล้ว', 'success');
  // Redirect to server-side logout to clear Django session and then to /login/
  try { window.location.href = '/auth/logout/'; } catch (_) { try { window.location.href = '/login/'; } catch (_) {} }
}

function getRoleDisplayName(role) {
  const roleNames = {
    customer: '👤 ลูกค้า',
    staff: '👨‍💼 พนักงาน',
    chef: '👨‍🍳 เชฟ',
    rider: '🏍️ ไรเดอร์',
    admin: '👑 แอดมิน',
  };
  return roleNames[role] || role;
}

// Interface management
function showInterface(role) {
  hideAllInterfaces();
  const map = {
    customer: 'customerInterface',
    staff: 'staffInterface',
    chef: 'chefInterface',
    rider: 'riderInterface',
    admin: 'adminInterface',
  };
  const id = map[role];
  if (id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('hidden');
    loadRoleData(role);
  }
}

function hideAllInterfaces() {
  ['customerInterface', 'staffInterface', 'chefInterface', 'riderInterface', 'adminInterface'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });
}

function loadRoleData(role) {
  switch (role) {
    case 'customer':
      loadFeaturedMenu();
      loadMenuGrid();
      loadCustomerOrders();
      loadFavorites();
      updateCartDisplay();
      break;
    case 'staff':
      loadStaffOrdersSection(); // โหลดหน้ารอเสิร์ฟ
      loadStaffPayments();      // โหลดหน้ารอชำระเงิน
      loadStaffStats();
      break;
    case 'chef':
      loadChefOrders();
      loadChefMenu();
      loadInventory();
      loadChefStats();
      break;
    case 'rider':
      loadAvailableDeliveries();
      loadCurrentDelivery();
      loadDeliveryHistory();
      loadRiderStats();
      break;
    case 'admin':
      loadAdminDashboard();
      loadAdminOrders();
      loadAdminMenu();
      loadAdminUsers();
      break;
  }
}

// Customer functions
// moved to customer.js (customer nav)

// moved to customer.js (featured/menu grid/favorites/cart display and totals)

// moved to customer.js (checkout flow)

// moved to customer.js (customer orders UI and actions)

function getStatusText(status) {
  const map = { pending: 'รอดำเนินการ', preparing: 'กำลังเตรียม', ready: 'พร้อมแล้ว', delivering: 'กำลังส่ง', completed: 'เสร็จสิ้น', cancelled: 'ยกเลิก' };
  return map[status] || status;
}

function getPaymentMethodText(input) {
  // Accept either method string or full order object; auto-correct legacy dine-in+cod to staff
  const method = typeof input === 'string' ? input : (input && input.paymentMethod);
  const type = typeof input === 'object' ? input.type : undefined;
  let normalized = method;
  if (type === 'dine-in' && method === 'cod') normalized = 'staff';
  const map = { qr: 'QR/โอน', cod: 'เก็บปลายทาง', staff: 'ชำระที่พนักงาน' };
  return map[normalized] || '-';
}

function getPaymentStatusText(order) {
  if (order.paymentMethod === 'qr') {
    return order.paymentStatus === 'paid' ? 'ชำระแล้ว' : 'รอชำระเงิน';
  }
  if (order.paymentMethod === 'staff' || (order.type === 'dine-in' && order.paymentMethod === 'cod')) {
    return order.paymentStatus === 'paid' ? 'ชำระแล้ว' : 'รอชำระที่พนักงาน';
  }
  return 'เก็บปลายทาง';
}

function confirmPayment(orderId) {
  const o = orders.find((x) => x.id === orderId);
  if (!o) return;
  if (o.paymentMethod !== 'qr') return showNotification('ออเดอร์นี้ไม่ได้ชำระด้วย QR', 'error');
  if (o.paymentStatus === 'paid') return showNotification('ชำระเงินแล้ว', 'success');
  o.paymentStatus = 'paid';
  logAction('payment', `ยืนยันการชำระเงิน (QR) สำหรับออเดอร์ #${orderId}`);
  loadCustomerOrders();
  loadAdminOrders();
  showNotification('ยืนยันการชำระเงินเรียบร้อย', 'success');
}

// moved to staff.js

// moved to staff.js

// Chef functions
function showChefSection(section) {
  document.querySelectorAll('.chef-nav-btn').forEach((btn) => {
    btn.classList.remove('active', 'bg-blue-500', 'text-white');
    btn.classList.add('bg-gray-200', 'text-gray-700');
  });
  if (window.event && window.event.currentTarget) {
    const t = window.event.currentTarget;
    t.classList.add('active', 'bg-blue-500', 'text-white');
    t.classList.remove('bg-gray-200', 'text-gray-700');
  }
  document.querySelectorAll('.chef-section').forEach((sec) => sec.classList.add('hidden'));
  const map = { orders: 'chefOrders', menu: 'chefMenu', inventory: 'chefInventory', stats: 'chefStats' };
  const id = map[section];
  if (id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('hidden');
    if (section === 'orders') loadChefOrders();
    if (section === 'menu') loadChefMenu();
    if (section === 'inventory') loadInventory();
    if (section === 'stats') loadChefStats();
  }
}

function loadChefOrders() {
  const container = document.getElementById('chefOrdersList');
  if (!container) return;
  const pending = orders.filter((o) => o.status === 'pending' || o.status === 'preparing');
  if (pending.length === 0) {
    container.innerHTML = `<div class="col-span-full text-center py-8"><div class="text-4xl mb-2">👨‍🍳</div><p class="text-gray-600">ไม่มีออเดอร์ที่รอทำ</p></div>`;
    return;
  }
  container.innerHTML = pending
    .map(
      (order) => `
      <div class="bg-white border-2 ${order.status === 'preparing' ? 'border-orange-300' : 'border-gray-200'} rounded-lg p-4">
        <div class="flex justify-between items-start mb-3">
          <div>
            <h4 class="font-bold">ออเดอร์ #${order.id.slice(-8)}</h4>
            <p class="text-sm text-gray-600">${order.customerName}</p>
            <span class="status-badge status-${order.status}">${getStatusText(order.status)}</span>
          </div>
          <span class="text-sm text-gray-500">${new Date(order.timestamp).toLocaleTimeString('th-TH')}</span>
        </div>
        <div class="space-y-1 mb-3 text-sm">
          ${order.items.map((i) => `<div class=\"flex justify-between\"><span class=\"font-medium\">${i.name}</span><span>x${i.quantity}</span></div>`).join('')}
        </div>
        <div class="flex space-x-2">
          ${order.status === 'pending'
            ? `<button onclick=\"startCooking('${order.id}')\" class=\"flex-1 bg-orange-500 text-white py-2 px-3 rounded text-sm hover:bg-orange-600\"><i class=\"fas fa-fire mr-1\"></i>เริ่มทำ</button>`
            : `<button onclick=\"finishCooking('${order.id}')\" class=\"flex-1 bg-green-500 text-white py-2 px-3 rounded text-sm hover:bg-green-600\"><i class=\"fas fa-check mr-1\"></i>เสร็จแล้ว</button>`}
        </div>
      </div>`
    )
    .join('');
}

function startCooking(orderId) {
  const order = orders.find((o) => o.id === orderId);
  if (order) {
    // Deduct ingredients stock according to menu usage mapping
    deductIngredientsForOrder(order);
    order.status = 'preparing';
    order.preparedBy = currentUser?.username || 'เชฟ';
    saveOrders();
    logAction('order', `เริ่มทำออเดอร์ #${orderId}`);
    loadChefOrders();
    loadInventory();
    showNotification('เริ่มทำอาหารแล้ว', 'success');
  }
}

function finishCooking(orderId) {
  const order = orders.find((o) => o.id === orderId);
  if (order) {
    order.status = 'ready';
    saveOrders();
    logAction('order', `ทำออเดอร์ #${orderId} เสร็จแล้ว`);
    loadChefOrders();
    loadChefStats();
    // Notify riders: new available delivery (ready & no rider)
    try { loadAvailableDeliveries(); } catch (_) {}
    if (currentRole === 'rider') {
      showNotification('มีงานเดลิเวอรี่ใหม่ที่รับได้', 'success');
    }
    showNotification('ทำอาหารเสร็จแล้ว พร้อมเสิร์ฟ!', 'success');
  }
}

function loadChefMenu() {
  const container = document.getElementById('chefMenuList');
  if (!container) return;
  container.innerHTML = menuItems
    .map(
      (item) => `
      <div class="bg-white border border-gray-200 rounded-lg p-4">
        <div class="h-32 bg-gray-200 rounded-lg mb-3 relative">
          <img src="${item.image || PLACEHOLDER_IMAGE}" alt="${item.name}" class="w-full h-full object-cover rounded-lg" onerror="setPlaceholderImg(this, 'รูปภาพไม่พร้อมใช้งาน')" />
          <div class="absolute top-2 right-2">
            <span class="px-2 py-1 text-xs rounded ${item.available ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}">${item.available ? 'พร้อม' : 'หมด'}</span>
          </div>
        </div>
        <h4 class="font-bold mb-1">${item.name}</h4>
        <p class="text-sm text-gray-600 mb-2">${item.description}</p>
        <p class="text-lg font-bold text-orange-500 mb-3">${item.price} บาท</p>
        <div class="flex space-x-2">
          <button onclick="toggleMenuAvailability('${item.id}')" class="flex-1 ${item.available ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'} text-white py-1 px-2 rounded text-sm">${item.available ? 'ปิดขาย' : 'เปิดขาย'}</button>
          <button onclick="showEditMenuModal('${item.id}')" class="flex-1 bg-blue-500 text-white py-1 px-2 rounded text-sm hover:bg-blue-600">แก้ไข</button>
        </div>
      </div>`
    )
    .join('');
}

function toggleMenuAvailability(menuId) {
  const item = menuItems.find((m) => m.id === menuId);
  if (item) {
    item.available = !item.available;
    saveMenuItems();
    loadChefMenu();
    if (typeof window.loadFeaturedMenu === 'function') window.loadFeaturedMenu();
    if (typeof window.loadMenuGrid === 'function') window.loadMenuGrid();
    showNotification(`${item.available ? 'เปิดขาย' : 'ปิดขาย'} ${item.name} แล้ว`, 'success');
  }
}

function loadInventory() {
  const container = document.getElementById('inventoryTable');
  if (!container) return;
  container.innerHTML = ingredients
    .map(
      (item) => `
      <tr class="border-b">
        <td class="px-4 py-2">${item.name}</td>
        <td class="px-4 py-2 ${item.stock <= item.minStock ? 'text-red-500 font-bold' : ''}">${item.stock}</td>
        <td class="px-4 py-2">${item.unit}</td>
        <td class="px-4 py-2"><span class="px-2 py-1 text-xs rounded ${item.stock <= item.minStock ? 'bg-red-500 text-white' : 'bg-green-500 text-white'}">${item.stock <= item.minStock ? 'ใกล้หมด' : 'ปกติ'}</span></td>
        <td class="px-4 py-2">
          <button onclick="updateStock('${item.id}', 10)" class="bg-blue-500 text-white px-2 py-1 rounded text-xs hover:bg-blue-600 mr-1">เพิ่ม</button>
          <button onclick="updateStock('${item.id}', -5)" class="bg-orange-500 text-white px-2 py-1 rounded text-xs hover:bg-orange-600">ใช้</button>
        </td>
      </tr>`
    )
    .join('');
}

function updateStock(ingredientId, change) {
  const item = ingredients.find((i) => i.id === ingredientId);
  if (item) {
    item.stock = Math.max(0, item.stock + change);
    saveIngredients();
    loadInventory();
    showNotification(`อัพเดทสต็อก ${item.name} แล้ว`, 'success');
  }
}

// GPS helpers
function buildMapsLink(order) {
  try {
    const lat = order && (order.lat || (order.coordinates && order.coordinates.lat));
    const lng = order && (order.lng || (order.coordinates && order.coordinates.lng));
    if (lat && lng) return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    if (order && order.address) return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(order.address)}`;
  } catch (_) {}
  return null;
}

function openGps(orderId) {
  const order = orders.find((o) => o.id === orderId);
  if (!order) return showNotification('ไม่พบออเดอร์', 'error');
  const url = buildMapsLink(order);
  if (!url) return showNotification('ไม่พบที่อยู่หรือพิกัดปลายทาง', 'error');
  window.open(url, '_blank');
}

// Customer location
function useCurrentLocation() {
  if (!navigator.geolocation) {
    return showNotification('เบราว์เซอร์ไม่รองรับการระบุตำแหน่ง', 'error');
  }
  const status = document.getElementById('locationStatus');
  if (status) {
    status.textContent = 'กำลังขอตำแหน่ง…';
    status.classList.remove('hidden');
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      const latEl = document.getElementById('deliveryLat');
      const lngEl = document.getElementById('deliveryLng');
      if (latEl) latEl.value = String(latitude);
      if (lngEl) lngEl.value = String(longitude);
      if (status) status.textContent = `พิกัดบันทึกแล้ว: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
      showNotification('บันทึกตำแหน่งแล้ว', 'success');
    },
    (err) => {
      if (status) status.textContent = 'ไม่สามารถรับตำแหน่งได้';
      showNotification('ไม่สามารถรับตำแหน่งได้ กรุณาอนุญาตการระบุตำแหน่ง', 'error');
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
  );
}

// Rider location updater
function updateRiderLocation(orderId) {
  const order = orders.find((o) => o.id === orderId);
  if (!order) return showNotification('ไม่พบออเดอร์', 'error');
  if (!navigator.geolocation) {
    return showNotification('อุปกรณ์ไม่รองรับการระบุตำแหน่ง', 'error');
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      order.riderLat = pos.coords.latitude;
      order.riderLng = pos.coords.longitude;
      showNotification('อัปเดตตำแหน่งไรเดอร์แล้ว', 'success');
      // If tracking modal open for this order, refresh it
      const trkIdEl = document.getElementById('trkOrderId');
      if (trkIdEl && trkIdEl.textContent && trkIdEl.textContent.endsWith(order.id.slice(-8))) {
        refreshTrackingView(order);
      }
    },
    () => showNotification('ไม่สามารถอัปเดตตำแหน่งได้', 'error'),
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 15000 }
  );
}

function loadChefStats() {
  const totalOrders = document.getElementById('chefTotalOrders');
  const completedOrders = document.getElementById('chefCompletedOrders');
  if (!totalOrders || !completedOrders) return;
  const today = new Date().toDateString();
  const todayOrders = orders.filter((o) => new Date(o.timestamp).toDateString() === today);
  const completed = todayOrders.filter((o) => ['completed', 'ready', 'delivering'].includes(o.status));
  totalOrders.textContent = todayOrders.length;
  completedOrders.textContent = completed.length;

  // Populate status breakdown for today
  try {
    const statusEl = document.getElementById('chefStatusList');
    if (statusEl) {
      const statusNames = {
        pending: 'รอดำเนินการ',
        preparing: 'กำลังเตรียม',
        ready: 'พร้อมเสิร์ฟ',
        delivering: 'กำลังส่ง',
        served: 'เสิร์ฟแล้ว',
        completed: 'ชำระแล้ว',
        cancelled: 'ยกเลิก',
      };
      const counts = todayOrders.reduce((acc, o) => { acc[o.status] = (acc[o.status] || 0) + 1; return acc; }, {});
      const order = ['pending','preparing','ready','delivering','served','completed','cancelled'];
      statusEl.innerHTML = order
        .filter(k => counts[k])
        .map(k => `<div class="flex items-center justify-between"><span>${statusNames[k] || k}</span><span class="font-semibold">${counts[k]}</span></div>`)
        .join('') || '<div class="text-sm text-gray-500">ไม่มีข้อมูล</div>';
    }
  } catch (_) {}

  // Populate category counts from today's ordered items
  try {
    const catEl = document.getElementById('chefCategoryList');
    if (catEl) {
      const catCounts = {};
      todayOrders.forEach(o => {
        (o.items || []).forEach(it => {
          const m = menuItems.find(mm => mm.id === it.id);
          const cat = (m && m.category) || 'other';
          catCounts[cat] = (catCounts[cat] || 0) + (it.quantity || 1);
        });
      });
      const catNames = { appetizer: 'อาหารเรียกน้ำย่อย', main: 'อาหารจานหลัก', dessert: 'ของหวาน', beverage: 'เครื่องดื่ม', other: 'อื่นๆ' };
      const rows = Object.entries(catCounts).sort((a,b)=>b[1]-a[1]).map(([c, n]) => `<div class="flex items-center justify-between"><span>${catNames[c] || c}</span><span class="font-semibold">${n}</span></div>`).join('');
      catEl.innerHTML = rows || '<div class="text-sm text-gray-500">ไม่มีข้อมูล</div>';
    }
  } catch (_) {}

  // Recent order history (latest 6)
  try {
    const histEl = document.getElementById('chefOrderHistory');
    if (histEl) {
      const recent = [...orders].sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp)).slice(0,6);
      histEl.innerHTML = recent.map(o => `
        <div class="flex items-center justify-between text-sm py-1">
          <div class="truncate"><span class="font-semibold">#${(o.id||'').toString().slice(-8)}</span> · ${o.customerName || 'ลูกค้า'}</div>
          <div class="text-gray-600">${new Date(o.timestamp).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'})}</div>
        </div>`).join('') || '<div class="text-sm text-gray-500">ยังไม่มีออเดอร์</div>';
    }
  } catch(_) {}

  // Latest menu items (by createdAt)
  try {
    const latestEl = document.getElementById('chefLatestItems');
    if (latestEl) {
      const latest = [...menuItems]
        .map(m => ({...m, _createdAt: m.createdAt ? new Date(m.createdAt).getTime() : 0}))
        .sort((a,b)=>b._createdAt - a._createdAt)
        .slice(0,6);
      latestEl.innerHTML = latest.map(m => `
        <div class="flex items-center gap-3">
          <div class="w-14 h-14 rounded overflow-hidden bg-gray-100">
            <img src="${m.image || PLACEHOLDER_IMAGE}" class="w-full h-full object-cover" onerror="setPlaceholderImg(this, 'รูปภาพไม่พร้อมใช้งาน')" />
          </div>
          <div class="min-w-0">
            <div class="font-semibold truncate">${m.name}</div>
            <div class="text-xs text-gray-600">${m.price} บาท</div>
          </div>
        </div>`).join('') || '<div class="text-sm text-gray-500">ยังไม่มีเมนูล่าสุด</div>';
    }
  } catch (_) {}
}

// Rider functions
function showRiderSection(section) {
  document.querySelectorAll('.rider-nav-btn').forEach((btn) => {
    btn.classList.remove('active', 'bg-blue-500', 'text-white');
    btn.classList.add('bg-gray-200', 'text-gray-700');
  });
  if (window.event && window.event.currentTarget) {
    const t = window.event.currentTarget;
    t.classList.add('active', 'bg-blue-500', 'text-white');
    t.classList.remove('bg-gray-200', 'text-gray-700');
  }
  document.querySelectorAll('.rider-section').forEach((sec) => sec.classList.add('hidden'));
  const map = { available: 'riderAvailable', current: 'riderCurrent', history: 'riderHistory', stats: 'riderStats' };
  const id = map[section];
  if (id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('hidden');
    if (section === 'available') loadAvailableDeliveries();
    if (section === 'current') {
      loadCurrentDelivery();
      ensureRiderCurrentAutoRefresh(true);
    } else {
      ensureRiderCurrentAutoRefresh(false);
    }
    if (section === 'history') loadDeliveryHistory();
    if (section === 'stats') loadRiderStats();
  }
}

function loadAvailableDeliveries() {
  const container = document.getElementById('availableDeliveries');
  if (!container) return;
  const available = orders.filter((o) => o.status === 'ready' && (o.type === 'delivery' || o.type === 'takeaway') && !o.riderId);
  if (available.length === 0) {
    container.innerHTML = `<div class="text-center py-8"><div class="text-4xl mb-2">🏍️</div><p class="text-gray-600">ไม่มีงานส่งที่รับได้</p></div>`;
    return;
  }
  container.innerHTML = available
    .map(
      (order) => `
      <div class="bg-white border border-gray-200 rounded-lg p-4">
        <div class="flex justify-between items-start mb-3">
          <div>
            <h4 class="font-bold">ออเดอร์ #${order.id.slice(-8)}</h4>
            <p class="text-sm text-gray-600">${order.customerName}</p>
            <p class="text-sm text-gray-600">📍 ${order.address}</p>
          </div>
          <div class="text-right">
            <span class="text-lg font-bold text-green-600">${order.deliveryFee} บาท</span>
            <p class="text-sm text-gray-500">ค่าส่ง</p>
          </div>
        </div>
        <div class="space-y-1 mb-3 text-sm">
          ${order.items.map((i) => `<div class=\"flex justify-between\"><span>${i.name} x${i.quantity}</span><span>${i.price * i.quantity} บาท</span></div>`).join('')}
        </div>
        <div class="space-y-2">
          <button onclick="openGps('${order.id}')" class="w-full bg-indigo-600 text-white py-2 px-3 rounded text-sm hover:bg-indigo-700"><i class="fas fa-map-marked-alt mr-1"></i>เปิดแผนที่</button>
          <button onclick="acceptDelivery('${order.id}')" class="w-full bg-blue-500 text-white py-2 px-3 rounded text-sm hover:bg-blue-600"><i class="fas fa-hand-holding-heart mr-1"></i>รับงาน</button>
        </div>
      </div>`
    )
    .join('');
}

function acceptDelivery(orderId) {
  const order = orders.find((o) => o.id === orderId);
  if (!order) return;
  order.riderId = 'rider1';
  order.status = 'delivering';
  try { saveOrders && saveOrders(); } catch(_) {}
  // Auto-open GPS after accepting a job (respect preference)
  try {
    const pref = getRiderAutoOpenPref();
    if (pref) openGps(orderId);
  } catch (_) { openGps(orderId); }
  loadAvailableDeliveries();
  loadCurrentDelivery();
  showNotification('รับงานแล้ว', 'success');
}

// Rider current job auto-refresh
function ensureRiderCurrentAutoRefresh(start) {
  if (start) {
    if (window.riderCurrentRefreshTimer) clearInterval(window.riderCurrentRefreshTimer);
    window.riderCurrentRefreshTimer = setInterval(() => {
      const currentSec = document.getElementById('riderCurrent');
      if (currentSec && !currentSec.classList.contains('hidden')) {
        loadCurrentDelivery();
      }
    }, 12000);
  } else if (window.riderCurrentRefreshTimer) {
    clearInterval(window.riderCurrentRefreshTimer);
    window.riderCurrentRefreshTimer = null;
  }
}

function loadCurrentDelivery() {
  const container = document.getElementById('currentDelivery');
  if (!container) return;
  const current = orders.find((o) => o.status === 'delivering' && o.riderId);
  if (!current) {
    container.innerHTML = `<div class="text-center text-gray-600">ยังไม่มีงานปัจจุบัน</div>`;
    return;
  }
  container.innerHTML = `
    <div class="bg-white border border-gray-200 rounded-lg p-4">
      <div class="flex justify-between items-start mb-3">
        <div>
          <h4 class="font-bold">ออเดอร์ #${current.id.slice(-8)}</h4>
          <p class="text-sm text-gray-600">${current.customerName}</p>
          <p class="text-sm text-gray-600">📍 ${current.address}</p>
        </div>
        <span class="status-badge status-delivering">กำลังส่ง</span>
      </div>
      <div class="space-y-2">
        <button onclick="openGps('${current.id}')" class="w-full bg-indigo-600 text-white py-2 px-3 rounded text-sm hover:bg-indigo-700"><i class="fas fa-location-arrow mr-1"></i>ไปที่ GPS</button>
        <button onclick="updateRiderLocation('${current.id}')" class="w-full bg-blue-600 text-white py-2 px-3 rounded text-sm hover:bg-blue-700"><i class="fas fa-location mr-1"></i>อัปเดตตำแหน่งของฉัน</button>
        <button onclick="completeDelivery('${current.id}')" class="w-full bg-green-500 text-white py-2 px-3 rounded text-sm hover:bg-green-600"><i class="fas fa-check mr-1"></i>ส่งสำเร็จ</button>
      </div>
    </div>`;
}

function completeDelivery(orderId) {
  const order = orders.find((o) => o.id === orderId);
  if (!order) return;
  order.status = 'completed';
  try { saveOrders && saveOrders(); } catch(_) {}
  logAction('order', `ไรเดอร์ส่งออเดอร์ #${orderId} สำเร็จ`);
  loadCurrentDelivery();
  loadDeliveryHistory();
  showNotification('ส่งออเดอร์สำเร็จ', 'success');
}

function loadDeliveryHistory() {
  const container = document.getElementById('deliveryHistory');
  if (!container) return;
  const history = orders.filter((o) => o.status === 'completed' && o.riderId);
  if (history.length === 0) {
    container.innerHTML = `<div class="text-center text-gray-600">ยังไม่มีประวัติการส่ง</div>`;
    return;
  }
  container.innerHTML = history
    .map(
      (order) => `
      <div class="bg-white border border-gray-200 rounded-lg p-4">
        <div class="flex justify-between items-start mb-3">
          <div>
            <h4 class="font-bold">ออเดอร์ #${order.id.slice(-8)}</h4>
            <p class="text-sm text-gray-600">${order.customerName}</p>
            <p class="text-sm text-gray-600">📍 ${order.address}</p>
          </div>
          <span class="status-badge status-completed">เสร็จสิ้น</span>
        </div>
        <div class="text-right font-bold">${order.deliveryFee} บาท</div>
      </div>`
    )
    .join('');
}

function loadRiderStats() {
  const totalDeliveries = document.getElementById('riderTotalDeliveries');
  const totalEarnings = document.getElementById('riderTotalEarnings');
  const avgTime = document.getElementById('riderAvgTime');
  const rating = document.getElementById('riderRating');
  if (!totalDeliveries) return;
  const completed = orders.filter((o) => o.status === 'completed' && o.riderId);
  totalDeliveries.textContent = completed.length;
  const earnings = completed.reduce((s, o) => s + (o.deliveryFee || 0), 0);
  totalEarnings.textContent = earnings.toLocaleString();
  avgTime.textContent = 18;
  rating.textContent = 4.9;
  
  // Payment mix
  const qrCount = completed.filter((o) => o.paymentMethod === 'qr').length;
  const codCount = completed.filter((o) => o.paymentMethod === 'cod').length;
  const totalPay = Math.max(1, qrCount + codCount);
  const qrPct = Math.round((qrCount / totalPay) * 100);
  const codPct = 100 - qrPct;
  const qrPctEl = document.getElementById('riderQrPct');
  const codPctEl = document.getElementById('riderCodPct');
  const qrBar = document.getElementById('riderQrBar');
  const codBar = document.getElementById('riderCodBar');
  if (qrPctEl) qrPctEl.textContent = `${qrPct}%`;
  if (codPctEl) codPctEl.textContent = `${codPct}%`;
  if (qrBar) qrBar.style.width = `${qrPct}%`;
  if (codBar) codBar.style.width = `${codPct}%`;
  
  // Daily trend (last 7 days, simple counts)
  const container = document.getElementById('riderDailySpark');
  if (container) {
    const days = [...Array(7)].map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const ds = d.toDateString();
      return completed.filter((o) => new Date(o.timestamp).toDateString() === ds).length;
    });
    const max = Math.max(1, ...days);
    container.innerHTML = days
      .map((v) => `<div class="w-6 bg-indigo-500 rounded-sm" style="height:${Math.max(2, Math.round((v / max) * 60))}px" title="${v} งาน"></div>`) 
      .join('');
  }
}

// Admin functions
function showAdminSection(section) {
  document.querySelectorAll('.admin-nav-btn').forEach((btn) => {
    btn.classList.remove('active', 'bg-blue-500', 'text-white');
    if (!btn.classList.contains('bg-gray-200')) btn.classList.add('bg-gray-200', 'text-gray-700');
  });
  if (window.event && window.event.currentTarget) {
    const t = window.event.currentTarget;
    t.classList.add('active', 'bg-blue-500', 'text-white');
    t.classList.remove('bg-gray-200', 'text-gray-700');
  }
  document.querySelectorAll('.admin-section').forEach((sec) => sec.classList.add('hidden'));
  const id = {
    dashboard: 'adminDashboard',
    orders: 'adminOrders',
    menu: 'adminMenu',
    combos: 'adminCombos',
    users: 'adminUsers',
    reports: 'adminReports',
    settings: 'adminSettings',
  }[section];
  if (id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('hidden');
    if (section === 'dashboard') loadAdminDashboard();
    if (section === 'orders') loadAdminOrders();
    if (section === 'menu') loadAdminMenu();
    if (section === 'combos') loadAdminCombos();
    if (section === 'users') loadAdminUsers();
    if (section === 'reports') loadAdminReports('day');
  }
}

function loadAdminDashboard() {
  const recent = document.getElementById('adminRecentOrders');
  const totalOrders = document.getElementById('adminTotalOrders');
  const totalRevenue = document.getElementById('adminTotalRevenue');
  if (recent) {
    const latest = [...orders].slice(-5).reverse();
    recent.innerHTML = latest
      .map(
        (o) => `
        <div class="flex justify-between items-center bg-white border border-gray-200 rounded-lg p-3">
          <div><div class="font-semibold">#${o.id.slice(-8)}</div><div class="text-sm text-gray-600">${o.customerName}</div></div>
          <div class="text-right"><div class="font-bold">${o.total} บาท</div><span class="status-badge status-${o.status}">${getStatusText(o.status)}</span></div>
        </div>`
      )
      .join('');
  }
  if (totalOrders) totalOrders.textContent = orders.length;
  if (totalRevenue) totalRevenue.textContent = `${orders.reduce((s, o) => s + (o.total || 0), 0).toLocaleString()} บาท`;
}

function loadAdminOrders() {
  const container = document.getElementById('adminOrdersList');
  if (!container) return;
  if (orders.length === 0) {
    container.innerHTML = `<div class="text-center text-gray-600">ยังไม่มีออเดอร์</div>`;
    return;
  }
  container.innerHTML = orders
    .map(
      (o) => `
      <div class="bg-white border border-gray-200 rounded-lg p-4">
        <div class="flex justify-between items-start">
          <div>
            <div class="font-bold">#${o.id.slice(-8)}</div>
            <div class="text-sm text-gray-600">${o.customerName}</div>
            <div class="mt-1">
              <span class="px-2 py-0.5 rounded text-xs ${o.type==='delivery' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-700'}">${o.type==='delivery' ? 'เดลิเวอรี่' : 'ทานในร้าน'}</span>
            </div>
            ${o.type === 'dine-in' && o.tableNumber ? `<div class="text-xs text-gray-700 mt-1">โต๊ะ: <span class="font-semibold">${o.tableNumber}</span></div>` : ''}
            <div class="text-xs text-gray-600 mt-1">ชำระเงิน: ${getPaymentMethodText(o)} | 
              <span class="px-2 py-0.5 rounded ${o.paymentMethod==='qr' ? (o.paymentStatus==='paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700') : (o.paymentMethod==='staff' || (o.type==='dine-in' && o.paymentMethod==='cod') ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700')}">${getPaymentStatusText(o)}</span>
            </div>
          </div>
          <div class="text-right">
            <div class="font-bold">${o.total} บาท</div>
            <span class="status-badge status-${o.status}">${getStatusText(o.status)}</span>
          </div>
        </div>
        ${ (o.paymentMethod==='staff' || (o.type==='dine-in' && o.paymentMethod==='cod')) && o.paymentStatus!=='paid' ? `
        <div class="mt-3">
          <button onclick="confirmStaffPayment('${o.id}')" class="bg-purple-600 text-white px-3 py-1.5 rounded text-sm hover:bg-purple-700"><i class="fas fa-hand-holding-usd mr-1"></i>ยืนยันรับชำระ (พนักงาน)</button>
        </div>` : ''}
      </div>`
    )
    .join('');
}

// Tracking modal
function openTracking(orderId) {
  const modal = document.getElementById('trackingModal');
  const order = orders.find((o) => o.id === orderId);
  if (!modal || !order) return;
  window.trackingActiveOrderId = orderId;
  (document.getElementById('trkOrderId') || {}).textContent = `#${order.id.slice(-8)}`;
  const statusEl = document.getElementById('trkOrderStatus');
  if (statusEl) statusEl.className = `status-badge status-${order.status}`, statusEl.textContent = getStatusText(order.status);
  refreshTrackingView(order);
  modal.classList.remove('hidden');
  const avatarImg = document.getElementById('profileAvatarImg');
  const avatarFallback = document.getElementById('profileAvatarFallback');
  // set avatar image or fallback
  const key = getProfileImageKey();
  const url = key ? localStorage.getItem(key) : null;
  if (avatarImg && avatarFallback) {
    if (url) {
      avatarImg.src = url;
      avatarImg.classList.remove('hidden');
      avatarFallback.classList.add('hidden');
    } else {
      avatarImg.classList.add('hidden');
      avatarFallback.classList.remove('hidden');
      if (currentUser) avatarFallback.textContent = getRoleDisplayName(currentUser.role).split(' ')[0];
    }
  }
  if (window.trackingRefreshTimer) clearInterval(window.trackingRefreshTimer);
  window.trackingRefreshTimer = setInterval(() => {
    const oid = window.trackingActiveOrderId;
    if (!oid) return;
    const latest = orders.find((o) => o.id === oid);
    if (latest) {
  // ensure dropdown hidden on open
  const menu = document.getElementById('profileImageMenu');
  if (menu) menu.classList.add('hidden');
      const st = document.getElementById('trkOrderStatus');
      if (st) st.className = `status-badge status-${latest.status}`, st.textContent = getStatusText(latest.status);
      refreshTrackingView(latest);
    }
  }, 12000);
}

// Profile avatar helpers (moved to global scope)
function getProfileImageKey() {
  if (!currentUser) return null;
  const id = currentUser.email || currentUser.id || currentUser.name || currentUser.role;
  return `profile_image_${id}`;
}

function triggerProfileImageFile() {
  const input = document.getElementById('profileImageFile');
  if (input) input.click();
}

function handleProfileImageUpload(e) {
  const file = e.target && e.target.files && e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const key = getProfileImageKey();
    try { if (key) localStorage.setItem(key, reader.result); } catch (_) {}
    setProfileAvatarImage(reader.result);
    showNotification('อัปโหลดรูปภาพแล้ว', 'success');
  };
  reader.readAsDataURL(file);
}

function promptProfileImageUrl() {
  const url = window.prompt('วางลิงก์รูปภาพ (URL)');
  if (!url) return;
  const key = getProfileImageKey();
  try { if (key) localStorage.setItem(key, url); } catch (_) {}
  setProfileAvatarImage(url);
  showNotification('ตั้งค่ารูปภาพโปรไฟล์แล้ว', 'success');
}

function clearProfileImage() {
  const key = getProfileImageKey();
  try { if (key) localStorage.removeItem(key); } catch (_) {}
  setProfileAvatarImage(null);
  showNotification('ลบรูปภาพโปรไฟล์แล้ว', 'success');
}

function setProfileAvatarImage(url) {
  const avatarImg = document.getElementById('profileAvatarImg');
  const avatarFallback = document.getElementById('profileAvatarFallback');
  if (avatarImg && avatarFallback) {
    if (url) {
      avatarImg.src = url;
      avatarImg.classList.remove('hidden');
      avatarFallback.classList.add('hidden');
    } else {
      avatarImg.classList.add('hidden');
      avatarFallback.classList.remove('hidden');
      if (currentUser) avatarFallback.textContent = getRoleDisplayName(currentUser.role).split(' ')[0];
    }
  }
  setNavAvatarImage(url);
}

function setNavAvatarImage(url) {
  const img = document.getElementById('navAvatarImg');
  const fb = document.getElementById('navAvatarFallback');
  if (img && fb) {
    if (url) {
      img.src = url;
      img.style.display = '';
      fb.style.display = 'none';
    } else {
      img.style.display = 'none';
      fb.style.display = '';
    }
  }
}

// Profile modal open/close
function openProfile() {
  const modal = document.getElementById('profileModal');
  if (!modal) return;
  // Fill profile fields
  const nameEl = document.getElementById('profileName');
  const roleEl = document.getElementById('profileRole');
  const emailEl = document.getElementById('profileEmail');
  const phoneEl = document.getElementById('profilePhone');
  const activeEl = document.getElementById('profileActive');
  if (currentUser) {
    if (nameEl) nameEl.textContent = currentUser.name || currentUser.username || '-';
    if (roleEl) roleEl.textContent = getRoleDisplayName(currentUser.role || '-');
    if (emailEl) emailEl.textContent = currentUser.email || '-';
    if (phoneEl) phoneEl.textContent = currentUser.phone || '-';
    if (activeEl) activeEl.textContent = 'ใช้งาน';
  }
  // Set avatar
  try {
    const key = getProfileImageKey();
    const url = key ? localStorage.getItem(key) : null;
    setProfileAvatarImage(url || null);
  } catch (_) {}
  // Ensure the image action menu is hidden initially
  const menu = document.getElementById('profileImageMenu');
  if (menu) menu.classList.add('hidden');
  modal.classList.remove('hidden');
}

function closeProfile() {
  const modal = document.getElementById('profileModal');
  if (modal) modal.classList.add('hidden');
  const menu = document.getElementById('profileImageMenu');
  if (menu) menu.classList.add('hidden');
}

function closeTrackingModal() {
  const modal = document.getElementById('trackingModal');
  if (modal) modal.classList.add('hidden');
  if (window.trackingRefreshTimer) {
    clearInterval(window.trackingRefreshTimer);
    window.trackingRefreshTimer = null;
    window.trackingActiveOrderId = null;
  }
}

function refreshTrackingView(order) {
  const addrEl = document.getElementById('trkCustomerAddr');
  const coordEl = document.getElementById('trkCustomerCoord');
  const rStatus = document.getElementById('trkRiderStatus');
  const rCoord = document.getElementById('trkRiderCoord');
  const btnDest = document.getElementById('trkOpenMapDest');
  const btnRider = document.getElementById('trkOpenMapRider');
  const statusEl = document.getElementById('trkOrderStatus');
  if (statusEl) statusEl.className = `status-badge status-${order.status}`, statusEl.textContent = getStatusText(order.status);
  if (addrEl) addrEl.textContent = order.address || '(ใช้พิกัดปัจจุบัน)';
  if (coordEl) coordEl.textContent = (order.lat && order.lng) ? `(${order.lat.toFixed?.(5) || order.lat}, ${order.lng.toFixed?.(5) || order.lng})` : '-';
  const hasRider = !!(order.riderLat && order.riderLng);
  if (rStatus) rStatus.textContent = hasRider ? 'กำลังอัปเดตตำแหน่ง' : 'ยังไม่มีพิกัดปัจจุบัน';
  if (rCoord) rCoord.textContent = hasRider ? `(${order.riderLat.toFixed?.(5) || order.riderLat}, ${order.riderLng.toFixed?.(5) || order.riderLng})` : '-';
  if (btnDest) btnDest.onclick = () => { const u = buildMapsLink(order); if (u) window.open(u, '_blank'); else showNotification('ไม่มีข้อมูลปลายทาง', 'error'); };
  if (btnRider) btnRider.onclick = () => {
    if (order.riderLat && order.riderLng) {
      const url = `https://www.google.com/maps/search/?api=1&query=${order.riderLat},${order.riderLng}`;
      window.open(url, '_blank');
    } else showNotification('ยังไม่มีพิกัดไรเดอร์', 'error');
  };
}

function loadAdminMenu() {
  const container = document.getElementById('adminMenuList');
  if (!container) return;
  container.innerHTML = menuItems
    .map(
      (item) => `
      <div class="bg-white border border-gray-200 rounded-lg p-4">
        <div class="h-32 bg-gray-200 rounded-lg mb-3 overflow-hidden">
          <img src="${item.image || PLACEHOLDER_IMAGE}" alt="${item.name}" class="w-full h-full object-cover" onerror="setPlaceholderImg(this, 'รูปภาพไม่พร้อมใช้งาน')" />
        </div>
        <h4 class="font-bold mb-1">${item.name}</h4>
        <p class="text-sm text-gray-600 mb-2">${item.description}</p>
        <p class="text-lg font-bold text-orange-500 mb-3">${item.price} บาท</p>
        <div class="flex space-x-2">
          <button onclick="showEditMenuModal('${item.id}')" class="flex-1 bg-blue-500 text-white py-1 px-2 rounded text-sm hover:bg-blue-600">แก้ไข</button>
        </div>
      </div>`
    )
    .join('');
}

function loadAdminCombos() {
  // Render sets list
  const list = document.getElementById('adminSetsList');
  if (list) {
    if (!foodSets || foodSets.length === 0) {
      list.innerHTML = `<div class="text-center text-gray-600">ยังไม่มีเซ็ตอาหาร</div>`;
    } else {
      list.innerHTML = foodSets.map((s) => {
        const base = computeSetBasePrice(s);
        const d = discounts.sets && discounts.sets[s.id];
        const final = applyDiscount(base, d);
        const itemsText = s.items.map((it) => {
          const m = menuItems.find((mm) => mm.id === it.menuId);
          return `${m ? m.name : it.menuId} x${it.qty}`;
        }).join(', ');
        return `
        <div class="bg-white border border-gray-200 rounded-lg p-4">
          <div class="flex items-start gap-3">
            <div class="w-20 h-20 bg-gray-100 rounded overflow-hidden flex-shrink-0">
              <img src="${s.image || ''}" class="w-full h-full object-cover" onerror="this.style.display='none'"/>
            </div>
            <div class="flex-1">
              <div class="flex items-center justify-between">
                <h4 class="font-bold">${s.name}</h4>
                <div class="text-right">
                  <div class="text-sm line-through text-gray-400">${base} บาท</div>
                  <div class="text-lg font-bold text-orange-600">${final} บาท</div>
                </div>
              </div>
              <div class="text-sm text-gray-600">${itemsText}</div>
              <div class="mt-3 flex gap-2">
                <button class="px-3 py-1 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded" onclick="showSetModal('${s.id}')"><i class="fas fa-edit mr-1"></i>แก้ไข</button>
                <button class="px-3 py-1 text-sm bg-red-500 hover:bg-red-600 text-white rounded" onclick="deleteSet('${s.id}')"><i class="fas fa-trash mr-1"></i>ลบ</button>
              </div>
            </div>
          </div>
        </div>`;
      }).join('');
    }
  }

  // Render menu item discounts
  const discMenuWrap = document.getElementById('adminMenuDiscounts');
  if (discMenuWrap) {
    discMenuWrap.innerHTML = menuItems.map((m) => {
      const d = (discounts.menuItems && discounts.menuItems[m.id]) || { type: 'none', value: 0, active: false };
      return `
      <div class="flex items-center gap-2">
        <div class="flex-1">
          <div class="font-medium">${m.name}</div>
          <div class="text-xs text-gray-500">ราคา ${m.price} บาท</div>
        </div>
        <select id="disc_menu_type_${m.id}" class="px-2 py-1 border rounded text-sm">
          <option value="none" ${d.type==='none'?'selected':''}>ไม่มี</option>
          <option value="percent" ${d.type==='percent'?'selected':''}>%</option>
          <option value="fixed" ${d.type==='fixed'?'selected':''}>฿</option>
        </select>
        <input id="disc_menu_val_${m.id}" type="number" class="w-24 px-2 py-1 border rounded text-sm" value="${d.value||0}" />
        <label class="text-sm flex items-center gap-1"><input id="disc_menu_active_${m.id}" type="checkbox" ${d.active?'checked':''}/> ใช้งาน</label>
      </div>`;
    }).join('');
  }

  // Render set discounts
  const discSetWrap = document.getElementById('adminSetDiscounts');
  if (discSetWrap) {
    if (!foodSets || foodSets.length === 0) {
      discSetWrap.innerHTML = `<div class="text-gray-600 text-sm">ยังไม่มีเซ็ตอาหาร</div>`;
    } else {
      discSetWrap.innerHTML = foodSets.map((s) => {
        const d = (discounts.sets && discounts.sets[s.id]) || { type: 'none', value: 0, active: false };
        const base = computeSetBasePrice(s);
        return `
        <div class="flex items-center gap-2">
          <div class="flex-1">
            <div class="font-medium">${s.name}</div>
            <div class="text-xs text-gray-500">ราคารวม ${base} บาท</div>
          </div>
          <select id="disc_set_type_${s.id}" class="px-2 py-1 border rounded text-sm">
            <option value="none" ${d.type==='none'?'selected':''}>ไม่มี</option>
            <option value="percent" ${d.type==='percent'?'selected':''}>%</option>
            <option value="fixed" ${d.type==='fixed'?'selected':''}>฿</option>
          </select>
          <input id="disc_set_val_${s.id}" type="number" class="w-24 px-2 py-1 border rounded text-sm" value="${d.value||0}" />
          <label class="text-sm flex items-center gap-1"><input id="disc_set_active_${s.id}" type="checkbox" ${d.active?'checked':''}/> ใช้งาน</label>
        </div>`;
      }).join('');
    }
  }
  // Render vouchers as part of this section
  renderAdminVouchers();
}

// Render vouchers list in Admin section
function renderAdminVouchers() {
  const wrap = document.getElementById('adminVouchersList');
  if (!wrap) return;
  if (!vouchers || vouchers.length === 0) {
    wrap.innerHTML = `<div class="text-gray-600 text-sm">ยังไม่มีคูปอง</div>`;
    return;
  }
  wrap.innerHTML = vouchers.map((v)=>{
    const typeText = v.type === 'percent' ? `${v.value}%` : `฿${v.value}`;
    const minText = v.min ? `ขั้นต่ำ ${v.min} บาท` : 'ไม่มีขั้นต่ำ';
    return `
      <div class="flex items-center justify-between bg-white border border-gray-200 rounded-lg p-3">
        <div>
          <div class="font-semibold">${v.code}</div>
          <div class="text-xs text-gray-500">${typeText} • ${minText}</div>
        </div>
        <div class="flex items-center gap-2">
          <label class="text-sm flex items-center gap-1"><input type="checkbox" ${v.active?'checked':''} onclick="toggleVoucher('${v.code}')"/> ใช้งาน</label>
          <button class="px-2 py-1 bg-red-100 text-red-600 rounded text-sm" onclick="deleteVoucher('${v.code}')"><i class="fas fa-trash mr-1"></i>ลบ</button>
        </div>
      </div>`;
  }).join('');
}

function persistVouchers() {
  try { localStorage.setItem(STORAGE_KEYS.vouchers, JSON.stringify(vouchers)); } catch (_) {}
}

function addVoucher() {
  const code = (document.getElementById('voucherCode')||{}).value?.trim();
  const type = (document.getElementById('voucherType')||{}).value || 'percent';
  const value = parseFloat((document.getElementById('voucherValue')||{}).value) || 0;
  const min = parseFloat((document.getElementById('voucherMin')||{}).value) || 0;
  if (!code) return showNotification('กรุณาใส่โค้ดคูปอง', 'error');
  if (!['percent','fixed'].includes(type)) return showNotification('ประเภทคูปองไม่ถูกต้อง', 'error');
  if (value <= 0) return showNotification('มูลค่าส่วนลดต้องมากกว่า 0', 'error');
  const exists = vouchers.find((v)=> v.code.toLowerCase() === code.toLowerCase());
  if (exists) return showNotification('มีโค้ดนี้อยู่แล้ว', 'error');
  vouchers.push({ code, type, value, min, active: true });
  persistVouchers();
  renderAdminVouchers();
  showNotification('เพิ่มคูปองแล้ว', 'success');
  // clear inputs
  const c1 = document.getElementById('voucherCode'); if (c1) c1.value = '';
  const c2 = document.getElementById('voucherValue'); if (c2) c2.value = '';
  const c3 = document.getElementById('voucherMin'); if (c3) c3.value = '';
}

function toggleVoucher(code) {
  const v = vouchers.find((x)=>x.code === code);
  if (!v) return;
  v.active = !v.active;
  persistVouchers();
  renderAdminVouchers();
}

function deleteVoucher(code) {
  vouchers = vouchers.filter((x)=>x.code !== code);
  if (selectedVoucherCode && selectedVoucherCode === code) {
    selectedVoucherCode = '';
    try { localStorage.setItem(STORAGE_KEYS.selectedVoucher, ''); } catch (_) {}
  }
  persistVouchers();
  renderAdminVouchers();
  updateCartTotal();
  showNotification('ลบคูปองแล้ว', 'success');
}

function getSelectedVoucher() {
  const sel = (document.getElementById('voucherSelect')||{}).value || selectedVoucherCode || '';
  if (!sel) return null;
  return vouchers.find((v)=> v.code === sel) || null;
}

function populateVoucherSelect(subtotal) {
  const selEl = document.getElementById('voucherSelect');
  if (!selEl) return;
  const applicable = (vouchers || []).filter((v)=> v.active && subtotal >= (parseFloat(v.min)||0));
  const prev = selEl.value || selectedVoucherCode || '';
  const options = [`<option value="">ไม่ใช้คูปอง</option>`]
    .concat(applicable.map((v)=>`<option value="${v.code}">${v.code} - ${v.type==='percent'?v.value+'%':'฿'+v.value}${v.min?` (ขั้นต่ำ ${v.min})`:''}</option>`));
  selEl.innerHTML = options.join('');
  // restore selection if still valid
  if (prev && applicable.find((v)=>v.code===prev)) {
    selEl.value = prev;
  } else {
    selEl.value = '';
    selectedVoucherCode = '';
    try { localStorage.setItem(STORAGE_KEYS.selectedVoucher, ''); } catch (_) {}
  }
}

function computeSetBasePrice(set) {
  if (!set || !Array.isArray(set.items)) return 0;
  return set.items.reduce((sum, it) => {
    const m = menuItems.find((mm) => mm.id === it.menuId);
    const price = m ? m.price : 0;
    return sum + price * (it.qty || 1);
  }, 0);
}

function applyDiscount(price, d) {
  if (!d || !d.active || !d.type || d.type === 'none') return Math.round(price);
  const val = parseFloat(d.value) || 0;
  if (d.type === 'percent') return Math.max(0, Math.round(price * (1 - val / 100)));
  if (d.type === 'fixed') return Math.max(0, Math.round(price - val));
  return Math.round(price);
}

function showSetModal(setId) {
  const modal = document.getElementById('setModal');
  if (!modal) return;
  (document.getElementById('setId')||{}).value = setId || '';
  (document.getElementById('setModalTitle')||{}).textContent = setId ? 'แก้ไขเซ็ตอาหาร' : 'สร้างเซ็ตอาหาร';
  const set = setId ? foodSets.find((s)=>s.id===setId) : null;
  (document.getElementById('setName')||{}).value = set?.name || '';
  (document.getElementById('setImageUrl')||{}).value = set?.image || '';
  (document.getElementById('setDiscountType')||{}).value = (discounts.sets[setId]?.type) || 'none';
  (document.getElementById('setDiscountValue')||{}).value = (discounts.sets[setId]?.value) || '';
  const wrap = document.getElementById('setItems');
  if (wrap) {
    wrap.innerHTML = '';
    const items = set?.items && set.items.length ? set.items : [{ menuId: menuItems[0]?.id, qty: 1 }];
    items.forEach((it)=> addSetItemRow(it.menuId, it.qty));
  }
  updateSetPricePreview();
  modal.classList.remove('hidden');
}

function closeSetModal() {
  const modal = document.getElementById('setModal');
  if (modal) modal.classList.add('hidden');
}

function addSetItemRow(menuId, qty) {
  const wrap = document.getElementById('setItems');
  if (!wrap) return;
  const id = `row_${Math.random().toString(36).slice(2,8)}`;
  const options = menuItems.map((m)=>`<option value="${m.id}" ${menuId===m.id?'selected':''}>${m.name}</option>`).join('');
  const q = qty || 1;
  const row = document.createElement('div');
  row.className = 'flex items-center gap-2';
  row.id = id;
  row.innerHTML = `
    <select class="px-2 py-2 border rounded flex-1" onchange="updateSetPricePreview()">
      ${options}
    </select>
    <input type="number" class="w-24 px-3 py-2 border rounded" value="${q}" min="1" onchange="updateSetPricePreview()" />
    <button class="px-3 py-2 bg-red-100 text-red-600 rounded" onclick="(function(el){el.parentElement.remove(); updateSetPricePreview();})(this)"><i class="fas fa-times"></i></button>
  `;
  wrap.appendChild(row);
}

function getSetFormData() {
  const itemsWrap = document.getElementById('setItems');
  const items = [];
  if (itemsWrap) {
    Array.from(itemsWrap.children).forEach((row) => {
      const sel = row.querySelector('select');
      const input = row.querySelector('input[type="number"]');
      if (sel && input) items.push({ menuId: sel.value, qty: parseInt(input.value, 10) || 1 });
    });
  }
  return {
    id: (document.getElementById('setId')||{}).value || `set_${Date.now()}`,
    name: (document.getElementById('setName')||{}).value?.trim() || 'เซ็ตใหม่',
    image: (document.getElementById('setImageUrl')||{}).value?.trim() || '',
    items,
  };
}

function updateSetPricePreview() {
  const data = getSetFormData();
  const base = computeSetBasePrice(data);
  const type = (document.getElementById('setDiscountType')||{}).value || 'none';
  const value = parseFloat((document.getElementById('setDiscountValue')||{}).value) || 0;
  const final = applyDiscount(base, { type, value, active: type!=='none' });
  const pv = document.getElementById('setPricePreview');
  if (pv) pv.textContent = final;
}

function saveSet() {
  const data = getSetFormData();
  if (!data.items.length) return showNotification('กรุณาเพิ่มรายการในเซ็ต', 'error');
  const idx = foodSets.findIndex((s)=>s.id===data.id);
  if (idx >= 0) foodSets[idx] = data; else foodSets.push(data);
  // save discount selection for this set
  const type = (document.getElementById('setDiscountType')||{}).value || 'none';
  const value = parseFloat((document.getElementById('setDiscountValue')||{}).value) || 0;
  discounts.sets = discounts.sets || {};
  discounts.sets[data.id] = { type, value, active: type !== 'none' };
  persistSetsAndDiscounts();
  closeSetModal();
  loadAdminCombos();
  showNotification('บันทึกเซ็ตอาหารแล้ว', 'success');
}

function deleteSet(id) {
  foodSets = foodSets.filter((s)=>s.id!==id);
  if (discounts.sets) delete discounts.sets[id];
  persistSetsAndDiscounts();
  loadAdminCombos();
  showNotification('ลบเซ็ตแล้ว', 'success');
}

function saveDiscounts() {
  // menu item discounts
  const menuDisc = {};
  menuItems.forEach((m)=>{
    const type = (document.getElementById(`disc_menu_type_${m.id}`)||{}).value || 'none';
    const value = parseFloat((document.getElementById(`disc_menu_val_${m.id}`)||{}).value) || 0;
    const active = !!(document.getElementById(`disc_menu_active_${m.id}`)||{}).checked;
    menuDisc[m.id] = { type, value, active };
  });
  // set discounts
  const setDisc = {};
  foodSets.forEach((s)=>{
    const type = (document.getElementById(`disc_set_type_${s.id}`)||{}).value || 'none';
    const value = parseFloat((document.getElementById(`disc_set_val_${s.id}`)||{}).value) || 0;
    const active = !!(document.getElementById(`disc_set_active_${s.id}`)||{}).checked;
    setDisc[s.id] = { type, value, active };
  });
  discounts = { menuItems: menuDisc, sets: setDisc };
  persistSetsAndDiscounts();
  showNotification('บันทึกส่วนลดแล้ว', 'success');
}

function persistSetsAndDiscounts() {
  try { localStorage.setItem(STORAGE_KEYS.sets, JSON.stringify(foodSets)); } catch(_) {}
  try { localStorage.setItem(STORAGE_KEYS.discounts, JSON.stringify(discounts)); } catch(_) {}
}

function loadAdminUsers() {
  const tbody = document.getElementById('adminUsersTable');
  if (!tbody) return;
  tbody.innerHTML = users
    .map(
      (u) => `
      <tr class="border-b">
        <td class="px-4 py-2">${u.name}</td>
        <td class="px-4 py-2">${u.email}</td>
        <td class="px-4 py-2">${getRoleDisplayName(u.role)}</td>
        <td class="px-4 py-2">${u.active ? '<span class="px-2 py-1 text-xs rounded bg-green-500 text-white">ใช้งาน</span>' : '<span class="px-2 py-1 text-xs rounded bg-gray-400 text-white">ปิดใช้งาน</span>'}</td>
        <td class="px-4 py-2"><button class="bg-blue-500 text-white px-2 py-1 rounded text-xs hover:bg-blue-600">แก้ไข</button></td>
      </tr>`
    )
    .join('');
}

// Misc utilities
function showNotification(message, type = 'success') {
  const notif = document.getElementById('notification');
  if (!notif) return;
  notif.textContent = message;
  notif.className = `notification show ${type}`;
  setTimeout(() => {
    notif.classList.remove('show');
  }, 2000);
}

function logAction(action, message) {
  systemLogs.push({ action, message, time: new Date().toISOString() });
}

function showAddMenuModal() {
  const modal = document.getElementById('addMenuModal');
  if (modal) modal.classList.remove('hidden');
}

function closeAddMenuModal() {
  const modal = document.getElementById('addMenuModal');
  if (modal) modal.classList.add('hidden');
}

function handleAddMenu(e) {
  e.preventDefault();
  const name = document.getElementById('menuName').value.trim();
  const category = document.getElementById('menuCategory').value;
  const price = parseInt(document.getElementById('menuPrice').value, 10) || 0;
  const description = document.getElementById('menuDescription').value.trim();
  const imageUrl = (document.getElementById('menuImageUrl') || {}).value?.trim() || '';
  const fileEl = document.getElementById('menuImageFile');
  const file = fileEl && fileEl.files && fileEl.files[0];
  if (!name || !category || !price) return showNotification('กรุณากรอกข้อมูลเมนูให้ครบ', 'error');
  const id = 'menu_' + Date.now();
  const finalizeAdd = (img) => {
    menuItems.push({ id, name, category, price, description, image: img || imageUrl, available: true, featured: false, ingredientsUsage: {}, createdAt: new Date().toISOString() });
    saveMenuItems();
    closeAddMenuModal();
    loadChefMenu();
    loadAdminMenu();
    if (typeof window.loadMenuGrid === 'function') window.loadMenuGrid();
    showNotification('เพิ่มเมนูใหม่แล้ว', 'success');
  };
  if (file) {
    if (!file.type || !file.type.startsWith('image/')) return showNotification('กรุณาเลือกไฟล์รูปภาพ', 'error');
    const reader = new FileReader();
    reader.onload = (ev) => finalizeAdd(ev.target.result);
    reader.readAsDataURL(file);
  } else {
    finalizeAdd(imageUrl);
  }
}

// QR Login helpers
function updateLoginQrPreview() {
  const roleSel = document.getElementById('qrLoginRole');
  const disp = document.getElementById('loginQrDisplay');
  if (!roleSel || !disp) return;
  const role = roleSel.value || 'customer';
  const txt = {
    customer: 'ลูกค้า',
    staff: 'พนักงาน',
    chef: 'เชฟ',
    rider: 'ไรเดอร์',
    admin: 'แอดมิน',
  }[role] || role;
  disp.innerHTML = `<div class="text-xs text-gray-600">QR เข้าสู่ระบบสำหรับ: <b>${txt}</b><br/>สแกนด้วยแอปของร้าน</div>`;
}

function scanQrLogin() {
  const roleSel = document.getElementById('qrLoginRole');
  const role = (roleSel && roleSel.value) || 'customer';
  const disp = document.getElementById('loginQrDisplay');
  if (disp) disp.innerHTML = '<div class="text-green-600 text-xs">✅ สแกนสำเร็จ กำลังเข้าระบบ...</div>';
  quickLogin(role);
}

function generateQRCode() {
  const data = (document.getElementById('qrCodeData') || {}).value || '';
  const img = document.getElementById('qrCodeImage');
  if (!img) return;
  img.textContent = '';
  img.innerHTML = `<div class="text-xs text-gray-600">📱 QR Code PromptPay<br/>${data || 'N/A'}</div>`;
  showNotification('อัพเดท QR Code แล้ว', 'success');
}

function saveSettings() {
  const feeInput = document.getElementById('defaultDeliveryFee');
  const newFee = feeInput ? parseInt(feeInput.value, 10) : null;
  const heroInput = document.getElementById('heroImageUrl');
  const heroUrl = heroInput ? heroInput.value.trim() : null;
  
  if (newFee && window.elementSdk) {
    window.elementSdk.config = Object.assign({}, window.elementSdk.config || {}, { delivery_fee: String(newFee) });
  } else {
    defaultConfig.delivery_fee = String(newFee || defaultConfig.delivery_fee);
  }
  
  if (heroUrl !== null) {
    if (window.elementSdk) {
      window.elementSdk.config = Object.assign({}, window.elementSdk.config || {}, { hero_image_url: heroUrl });
    } else {
      defaultConfig.hero_image_url = heroUrl || defaultConfig.hero_image_url;
    }
    setHeroImageFromConfig(window.elementSdk && window.elementSdk.config ? window.elementSdk.config : null);
  }
  
  updateCartTotal();
  showNotification('บันทึกการตั้งค่าแล้ว', 'success');
}

// Admin image upload handlers
function handleAdminImageUpload(event, type) {
  const file = event.target && event.target.files && event.target.files[0];
  if (!file) return;
  
  if (!file.type.startsWith('image/')) {
    showNotification('กรุณาเลือกไฟล์รูปภาพเท่านั้น', 'error');
    return;
  }
  
  const reader = new FileReader();
  reader.onload = function(e) {
    const imageUrl = e.target.result;
    
    // Apply to appropriate input and config
    if (type === 'hero') {
      const heroInput = document.getElementById('heroImageUrl');
      if (heroInput) heroInput.value = imageUrl;
      
      if (window.elementSdk) {
        window.elementSdk.config = Object.assign({}, window.elementSdk.config || {}, { hero_image_url: imageUrl });
      } else {
        defaultConfig.hero_image_url = imageUrl;
      }
      setHeroImageFromConfig(window.elementSdk && window.elementSdk.config ? window.elementSdk.config : null);
    }
    
    showNotification('อัปโหลดรูปภาพสำเร็จ', 'success');
  };
  reader.readAsDataURL(file);
}

function promptAdminImageUrl(type) {
  const url = window.prompt('วางลิงก์รูปภาพ (URL):');
  if (!url) return;
  
  if (type === 'hero') {
    const heroInput = document.getElementById('heroImageUrl');
    if (heroInput) heroInput.value = url;
  }
  
  // Save the setting
  saveSettings();
}

// Start
window.addEventListener('DOMContentLoaded', initializeApp);

// Manage body scroll state with modal
(function manageModalScroll() {
  // If auth modal is visible by default, prevent background scroll
  const auth = document.getElementById('authModal');
  if (auth && !auth.classList.contains('hidden')) {
    document.body.classList.add('modal-open');
  }
})();

// Hero image helper
function setHeroImageFromConfig(config) {
  try {
    const img = document.getElementById('heroImage');
    if (!img) return;
    const src = (config && config.hero_image_url) || defaultConfig.hero_image_url || PLACEHOLDER_IMAGE;
    img.src = src || PLACEHOLDER_IMAGE;
  } catch (_) {}
}

// Toggle address input when using current location only
function toggleUseCurrentAddress() {
  const chk = document.getElementById('useCurrentAddressOnly');
  const ta = document.getElementById('deliveryAddressText');
  if (!chk || !ta) return;
  const using = !!chk.checked;
  ta.disabled = using;
  ta.classList.toggle('bg-gray-100', using);
}

// Payment section helpers
// moved to customer.js (payment options and QR preview)

// Rider GPS auto-open preference
function getRiderAutoOpenPref() {
  try {
    const v = localStorage.getItem('rider_auto_open_gps');
    if (v === null) return true; // default enabled
    return v === '1';
  } catch (_) { return true; }
}

function setRiderAutoOpenPref(val) {
  try { localStorage.setItem('rider_auto_open_gps', val ? '1' : '0'); } catch (_) {}
}

function initRiderAutoOpenToggle() {
  const chk = document.getElementById('autoOpenGpsToggle');
  if (!chk) return;
  chk.checked = !!getRiderAutoOpenPref();
  chk.addEventListener('change', () => setRiderAutoOpenPref(!!chk.checked));
}

// Edit menu modal logic
function showEditMenuModal(menuId) {
  const modal = document.getElementById('editMenuModal');
  const m = menuItems.find((x) => x.id === menuId);
  if (!modal || !m) return;
  // Fill fields
  (document.getElementById('editMenuId') || {}).value = m.id;
  (document.getElementById('editMenuName') || {}).value = m.name || '';
  (document.getElementById('editMenuCategory') || {}).value = m.category || 'main';
  (document.getElementById('editMenuPrice') || {}).value = m.price || 0;
  (document.getElementById('editMenuImageUrl') || {}).value = m.image || '';
  (document.getElementById('editMenuDescription') || {}).value = m.description || '';

  // Render ingredients usage list
  const list = document.getElementById('menuIngredientsList');
  if (list) {
    const usage = m.ingredientsUsage || {};
    list.innerHTML = ingredients
      .map(
        (ing) => `
        <div class="flex items-center justify-between border rounded-lg p-2">
          <div>
            <div class="font-medium">${ing.name}</div>
            <div class="text-xs text-gray-500">หน่วย: ${ing.unit}</div>
          </div>
          <div class="flex items-center space-x-2">
            <input type="number" step="0.01" min="0" id="ingusage_${ing.id}" class="w-24 px-2 py-1 border rounded" value="${usage[ing.id] ?? 0}" />
            <span class="text-sm text-gray-500">ต่อ 1 จาน</span>
          </div>
        </div>`
      )
      .join('');
  }

  modal.classList.remove('hidden');
}

function closeEditMenuModal() {
  const modal = document.getElementById('editMenuModal');
  if (modal) modal.classList.add('hidden');
}

// Attach edit form handler once
(function attachEditFormHandler() {
  const form = document.getElementById('editMenuForm');
  if (form) {
    form.addEventListener('submit', handleEditMenu);
  } else {
    // try again after DOM ready
    window.addEventListener('DOMContentLoaded', () => {
      const f = document.getElementById('editMenuForm');
      if (f) f.addEventListener('submit', handleEditMenu);
    });
  }
})();

function handleEditMenu(e) {
  e.preventDefault();
  const id = (document.getElementById('editMenuId') || {}).value;
  const m = menuItems.find((x) => x.id === id);
  if (!m) return closeEditMenuModal();
  const name = (document.getElementById('editMenuName') || {}).value?.trim() || m.name;
  const category = (document.getElementById('editMenuCategory') || {}).value || m.category;
  const price = parseInt((document.getElementById('editMenuPrice') || {}).value, 10) || m.price;
  const imageUrlInput = (document.getElementById('editMenuImageUrl') || {}).value?.trim() || m.image;
  const fileEl = document.getElementById('editMenuImageFile');
  const file = fileEl && fileEl.files && fileEl.files[0];
  const description = (document.getElementById('editMenuDescription') || {}).value?.trim() || m.description;

  const usage = {};
  ingredients.forEach((ing) => {
    const val = parseFloat((document.getElementById(`ingusage_${ing.id}`) || {}).value);
    if (!isNaN(val) && val > 0) usage[ing.id] = val;
  });

  const finalizeUpdate = (img) => {
    Object.assign(m, { name, category, price, image: img || imageUrlInput, description, ingredientsUsage: usage });
    saveMenuItems();
    closeEditMenuModal();
    loadChefMenu();
    loadAdminMenu();
    if (typeof window.loadMenuGrid === 'function') window.loadMenuGrid();
    if (typeof window.loadFeaturedMenu === 'function') window.loadFeaturedMenu();
    showNotification('บันทึกการแก้ไขเมนูแล้ว', 'success');
  };
  if (file) {
    if (!file.type || !file.type.startsWith('image/')) return showNotification('กรุณาเลือกไฟล์รูปภาพ', 'error');
    const reader = new FileReader();
    reader.onload = (ev) => finalizeUpdate(ev.target.result);
    reader.readAsDataURL(file);
  } else {
    finalizeUpdate(imageUrlInput);
  }
}

function deductIngredientsForOrder(order) {
  if (!order || !Array.isArray(order.items)) return;
  order.items.forEach((it) => {
    const menu = menuItems.find((m) => m.id === it.id);
    if (!menu || !menu.ingredientsUsage) return;
    Object.entries(menu.ingredientsUsage).forEach(([ingId, amount]) => {
      const qty = it.quantity || 1;
      const totalNeeded = amount * qty;
      const ing = ingredients.find((i) => i.id === ingId);
      if (ing) ing.stock = Math.max(0, ing.stock - totalNeeded);
    });
  });
  // persist stock deductions
  saveIngredients();
}

// moved to staff.js

function getOrdersByPeriod(period) {
    const today = new Date();
    const startDate = new Date(today);
    
    switch(period) {
        case 'day':
            startDate.setHours(0,0,0,0);
            break;
        case 'week':
            startDate.setDate(today.getDate() - today.getDay());
            startDate.setHours(0,0,0,0);
            break;
        case 'month':
            startDate.setDate(1);
            startDate.setHours(0,0,0,0);
            break;
        case 'year':
            startDate.setMonth(0, 1);
            startDate.setHours(0,0,0,0);
            break;
    }
    
    return orders.filter(order => new Date(order.timestamp) >= startDate);
}

function loadRoleStatistics(filteredOrders) {
    // เชฟ
    const chefAccepted = filteredOrders.filter(o => o.status !== 'pending').length;
    const chefPreparing = filteredOrders.filter(o => o.status === 'preparing').length;
    const chefCompleted = filteredOrders.filter(o => o.status !== 'pending' && o.status !== 'preparing').length;
    
    document.getElementById('chefAcceptedOrders').textContent = chefAccepted;
    document.getElementById('chefPreparingOrders').textContent = chefPreparing;
    document.getElementById('chefCompletedOrders').textContent = chefCompleted;
    document.getElementById('chefAvgTime').textContent = '15'; // Mock data
    
    // พนักงาน
    const staffServed = filteredOrders.filter(o => o.status === 'served' || o.status === 'delivered' || o.status === 'completed').length;
    const staffPayments = filteredOrders.filter(o => o.status === 'completed').length;
    const staffSalesAmount = filteredOrders.filter(o => o.status === 'completed').reduce((sum, o) => sum + o.total, 0);
    
    document.getElementById('staffServedOrders').textContent = staffServed;
    document.getElementById('staffPaymentsProcessed').textContent = staffPayments;
    document.getElementById('staffTotalSalesAmount').textContent = staffSalesAmount.toLocaleString();
    document.getElementById('staffAvgTime').textContent = '8'; // Mock data
    
    // ไรเดอร์
    const riderAccepted = filteredOrders.filter(o => o.type === 'takeaway').length;
    const riderDelivering = filteredOrders.filter(o => o.status === 'delivering').length;
    const riderCompleted = filteredOrders.filter(o => o.type === 'takeaway' && o.status === 'delivered').length;
    
    document.getElementById('riderAcceptedOrders').textContent = riderAccepted;
    document.getElementById('riderDeliveringOrders').textContent = riderDelivering;
    document.getElementById('riderCompletedOrders').textContent = riderCompleted;
    document.getElementById('riderAvgTime').textContent = '25'; // Mock data
    
    // รายชื่อ (Mock data)
    loadRoleUserLists(filteredOrders);
}

function loadRoleUserLists(filteredOrders) {
    // เชฟ
    const chefs = new Set();
    filteredOrders.forEach(o => {
        if (o.preparedBy) chefs.add(o.preparedBy);
    });
    const chefsList = document.getElementById('chefsList');
    if (chefsList) {
        if (chefs.size === 0) {
            chefsList.innerHTML = '<p class="text-sm text-gray-500">ไม่มีข้อมูล</p>';
        } else {
            chefsList.innerHTML = Array.from(chefs).map(chef => `
                <div class="flex justify-between text-sm p-2 bg-white rounded">
                    <span><i class="fas fa-user mr-2"></i>${chef}</span>
                    <span class="text-gray-600">ใช้งาน</span>
                </div>
            `).join('');
        }
    }
    
    // พนักงาน
    const staffs = new Set();
    filteredOrders.forEach(o => {
        if (o.servedBy) staffs.add(o.servedBy);
        if (o.processedBy) staffs.add(o.processedBy);
    });
    const staffList = document.getElementById('staffList');
    if (staffList) {
        if (staffs.size === 0) {
            staffList.innerHTML = '<p class="text-sm text-gray-500">ไม่มีข้อมูล</p>';
        } else {
            staffList.innerHTML = Array.from(staffs).map(staff => {
                const staffOrders = filteredOrders.filter(o => o.servedBy === staff || o.processedBy === staff).length;
                return `
                    <div class="flex justify-between text-sm p-2 bg-white rounded">
                        <span><i class="fas fa-user mr-2"></i>${staff}</span>
                        <span class="text-gray-600">${staffOrders} ออเดอร์</span>
                    </div>
                `;
            }).join('');
        }
    }
    
    // ไรเดอร์ (Mock)
    const ridersList = document.getElementById('ridersList');
    if (ridersList) {
        ridersList.innerHTML = `
            <div class="flex justify-between text-sm p-2 bg-white rounded">
                <span><i class="fas fa-user mr-2"></i>rider1</span>
                <span class="text-gray-600">ใช้งาน</span>
            </div>
            <div class="flex justify-between text-sm p-2 bg-white rounded">
                <span><i class="fas fa-user mr-2"></i>rider2</span>
                <span class="text-gray-600">ใช้งาน</span>
            </div>
        `;
    }
}

function createAdminCharts(filteredOrders, period) {
    // กราฟยอดขาย
    const salesData = getSalesDataByPeriod(filteredOrders, period);
    const salesCtx = document.getElementById('adminSalesChart');
    if (salesCtx) {
        if (adminCharts.sales) adminCharts.sales.destroy();
        adminCharts.sales = new Chart(salesCtx, {
            type: 'line',
            data: {
                labels: salesData.labels,
                datasets: [{
                    label: 'ยอดขาย (บาท)',
                    data: salesData.values,
                    borderColor: 'rgb(34, 197, 94)',
                    backgroundColor: 'rgba(34, 197, 94, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: true }
                },
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });
    }
    
    // กราฟประเภทการสั่ง
    const dineIn = filteredOrders.filter(o => o.type === 'dine-in').length;
    const takeaway = filteredOrders.filter(o => o.type === 'takeaway').length;
    
    const orderTypeCtx = document.getElementById('adminOrderTypeChart');
    if (orderTypeCtx) {
        if (adminCharts.orderType) adminCharts.orderType.destroy();
        adminCharts.orderType = new Chart(orderTypeCtx, {
            type: 'doughnut',
            data: {
                labels: ['ทานที่ร้าน', 'สั่งกลับบ้าน'],
                datasets: [{
                    data: [dineIn, takeaway],
                    backgroundColor: ['#3b82f6', '#f59e0b']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });
    }
    
    // กราฟประสิทธิภาพตามบทบาท
    createRolePerformanceCharts(filteredOrders);
}

function getSalesDataByPeriod(filteredOrders, period) {
    const labels = [];
    const values = [];
    
    if (period === 'day') {
        // รายชั่วโมง
        for (let i = 0; i < 24; i++) {
            labels.push(`${i}:00`);
            const hourOrders = filteredOrders.filter(o => {
                const orderHour = new Date(o.timestamp).getHours();
                return orderHour === i && o.status === 'completed';
            });
            values.push(hourOrders.reduce((sum, o) => sum + o.total, 0));
        }
    } else if (period === 'week') {
        // รายวัน 7 วัน
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            labels.push(date.toLocaleDateString('th-TH', {day: 'numeric', month: 'short'}));
            const dayStart = new Date(date);
            dayStart.setHours(0,0,0,0);
            const dayEnd = new Date(date);
            dayEnd.setHours(23,59,59,999);
            const dayOrders = filteredOrders.filter(o => {
                const orderDate = new Date(o.timestamp);
                return orderDate >= dayStart && orderDate <= dayEnd && o.status === 'completed';
            });
            values.push(dayOrders.reduce((sum, o) => sum + o.total, 0));
        }
    } else if (period === 'month') {
        // รายวันในเดือน
        const today = new Date();
        const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
        for (let i = 1; i <= daysInMonth; i++) {
            labels.push(`${i}`);
            const date = new Date(today.getFullYear(), today.getMonth(), i);
            const dayStart = new Date(date);
            dayStart.setHours(0,0,0,0);
            const dayEnd = new Date(date);
            dayEnd.setHours(23,59,59,999);
            const dayOrders = filteredOrders.filter(o => {
                const orderDate = new Date(o.timestamp);
                return orderDate >= dayStart && orderDate <= dayEnd && o.status === 'completed';
            });
            values.push(dayOrders.reduce((sum, o) => sum + o.total, 0));
        }
    } else {
        // รายเดือนในปี
        const monthNames = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
        for (let i = 0; i < 12; i++) {
            labels.push(monthNames[i]);
            const monthOrders = filteredOrders.filter(o => {
                const orderMonth = new Date(o.timestamp).getMonth();
                return orderMonth === i && o.status === 'completed';
            });
            values.push(monthOrders.reduce((sum, o) => sum + o.total, 0));
        }
    }
    
    return { labels, values };
}

function createRolePerformanceCharts(filteredOrders) {
    // กราฟเชฟ - จำนวนออเดอร์แต่ละคน
    const chefOrders = {};
    filteredOrders.forEach(o => {
        if (o.preparedBy) {
            chefOrders[o.preparedBy] = (chefOrders[o.preparedBy] || 0) + 1;
        }
    });
    
    const chefPerfCtx = document.getElementById('chefPerformanceChart');
    if (chefPerfCtx) {
        if (adminCharts.chefPerf) adminCharts.chefPerf.destroy();
        const chefNames = Object.keys(chefOrders);
        adminCharts.chefPerf = new Chart(chefPerfCtx, {
            type: 'bar',
            data: {
                labels: chefNames.length > 0 ? chefNames : ['ไม่มีข้อมูล'],
                datasets: [{
                    label: 'ออเดอร์ที่ทำ',
                    data: chefNames.length > 0 ? Object.values(chefOrders) : [0],
                    backgroundColor: 'rgba(239, 68, 68, 0.7)',
                    borderColor: 'rgb(239, 68, 68)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });
    }
    
    // กราฟพนักงาน
    const staffOrders = {};
    filteredOrders.forEach(o => {
        if (o.servedBy) {
            staffOrders[o.servedBy] = (staffOrders[o.servedBy] || 0) + 1;
        }
        if (o.processedBy && o.processedBy !== o.servedBy) {
            staffOrders[o.processedBy] = (staffOrders[o.processedBy] || 0) + 1;
        }
    });
    
    const staffPerfCtx = document.getElementById('staffPerformanceChartAdmin');
    if (staffPerfCtx) {
        if (adminCharts.staffPerf) adminCharts.staffPerf.destroy();
        const staffNames = Object.keys(staffOrders);
        adminCharts.staffPerf = new Chart(staffPerfCtx, {
            type: 'bar',
            data: {
                labels: staffNames.length > 0 ? staffNames : ['ไม่มีข้อมูล'],
                datasets: [{
                    label: 'ออเดอร์ที่จัดการ',
                    data: staffNames.length > 0 ? Object.values(staffOrders) : [0],
                    backgroundColor: 'rgba(59, 130, 246, 0.7)',
                    borderColor: 'rgb(59, 130, 246)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });
    }
    
    // กราฟไรเดอร์ (Mock data)
    const riderPerfCtx = document.getElementById('riderPerformanceChart');
    if (riderPerfCtx) {
        if (adminCharts.riderPerf) adminCharts.riderPerf.destroy();
        adminCharts.riderPerf = new Chart(riderPerfCtx, {
            type: 'bar',
            data: {
                labels: ['rider1', 'rider2'],
                datasets: [{
                    label: 'ออเดอร์ที่ส่ง',
                    data: [12, 8],
                    backgroundColor: 'rgba(34, 197, 94, 0.7)',
                    borderColor: 'rgb(34, 197, 94)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });
    }
}

// เรียกใช้เมื่อโหลด Admin Reports
function initAdminReports() {
    loadAdminReports('day');
}

// Admin reports loader (missing earlier)
function loadAdminReports(period) {
  const valid = ['day','week','month','year'];
  const p = valid.includes(period) ? period : 'day';
  // Update active tab buttons if exist
  ['day','week','month','year'].forEach((key)=>{
    const el = document.getElementById(`${key}ReportTab`);
    if (!el) return;
    if (key === p) { el.classList.add('bg-blue-500','text-white'); el.classList.remove('bg-gray-200','text-gray-700'); }
    else { el.classList.remove('bg-blue-500','text-white'); el.classList.add('bg-gray-200','text-gray-700'); }
  });
  const filtered = getOrdersByPeriod(p);
  // Simple KPIs
  const total = filtered.length;
  const revenue = filtered.filter(o=>o.status==='completed').reduce((s,o)=>s+(o.total||0),0);
  const k1 = document.getElementById('adminReportTotal'); if (k1) k1.textContent = total;
  const k2 = document.getElementById('adminReportRevenue'); if (k2) k2.textContent = revenue.toLocaleString() + ' บาท';
  // Build charts and role stats
  createAdminCharts(filtered, p);
  loadRoleStatistics(filtered);
}

// Export frequently used functions for inline handlers and generated HTML
Object.assign(window, {
  // Admin navigation & reports
  showAdminSection,
  loadAdminReports,
  // Admin: sets/discounts/vouchers
  showSetModal,
  closeSetModal,
  addSetItemRow,
  saveSet,
  deleteSet,
  saveDiscounts,
  addVoucher,
  toggleVoucher,
  deleteVoucher,
  // Admin: settings/images
  saveSettings,
  handleAdminImageUpload,
  promptAdminImageUrl,
  // Chef/Admin shared
  showEditMenuModal,
  closeEditMenuModal,
  toggleMenuAvailability,
  updateStock,
  // Profile helpers
  openProfile,
  closeProfile,
  triggerProfileImageFile,
  handleProfileImageUpload,
  promptProfileImageUrl,
  clearProfileImage,
  // Chef sections
  showChefSection,
  startCooking,
  finishCooking,
  loadChefOrders,
  loadChefMenu,
  loadInventory,
  // Rider
  showRiderSection,
  openGps,
  acceptDelivery,
  updateRiderLocation,
  completeDelivery,
  // Admin dashboard helpers
  loadAdminDashboard,
  loadAdminOrders,
  loadAdminMenu,
  loadAdminCombos,
  loadAdminUsers,
  // Add menu modal
  showAddMenuModal,
  closeAddMenuModal,
  // QR/demo helpers
  generateQRCode,
  quickLogin,
  logout,
  // Customer location
  useCurrentLocation,
  // Tracking
  closeTrackingModal,
});
