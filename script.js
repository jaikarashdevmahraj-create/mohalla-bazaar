const db = window.firebaseDB;
const auth = window.firebaseAuth;
const { collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc, arrayUnion, arrayRemove, query, where, orderBy, limit, startAfter, documentId } = window.firebaseTools;
const { onAuthStateChanged, signOut } = window.authTools;

const categories = [
  { id: "sab", label: "सब कुछ", emoji: "🏪" },
  { id: "sabzi", label: "सब्ज़ी-राशन", emoji: "🥕" },
  { id: "khana", label: "खाना/टिफिन", emoji: "🍲" },
  { id: "kapde", label: "कपड़े", emoji: "👕" },
  { id: "ghar", label: "घरेलू सामान", emoji: "🛋️" },
  { id: "electronics", label: "इलेक्ट्रॉनिक्स", emoji: "🔌" },
  { id: "handmade", label: "हस्तशिल्प", emoji: "🧶" },
  { id: "beauty", label: "सौंदर्य/देखभाल", emoji: "💄" },
  { id: "kheti", label: "खेती/कृषि", emoji: "🚜" },
  { id: "pashupalan", label: "पशुपालन", emoji: "🐄" },
  { id: "books", label: "किताबें/स्टेशनरी", emoji: "📚" },
  { id: "toys", label: "खिलौने", emoji: "🧸" },
  { id: "tools", label: "औज़ार/हार्डवेयर", emoji: "🔧" },
  { id: "vehicle", label: "गाड़ी/स्पेयर पार्ट्स", emoji: "🚗" },
];

const demoListings = [
  { id: "d1", title: "ताज़ा देसी टमाटर (1 किलो)", price: 40, cat: "sabzi", sellerName: "सुनीता जी", sellerArea: "शास्त्री नगर", dist: "350 मीटर", img: "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=400&q=60", isDemo: true },
  { id: "d2", title: "हाथ से बुना ऊनी शॉल", price: 850, cat: "handmade", sellerName: "अजय हैंडीक्राफ्ट", sellerArea: "मॉडल टाउन", dist: "2.1 किमी", img: "https://images.unsplash.com/photo-1520903920243-00d872a2d1c9?w=400&q=60", isDemo: true },
  { id: "d3", title: "कॉटन कुर्ती (M साइज़)", price: 320, cat: "kapde", sellerName: "प्रिया स्टोर्स", sellerArea: "नेहरू कॉलोनी", dist: "900 मीटर", img: "https://images.unsplash.com/photo-1583391733956-6c78276477e2?w=400&q=60", isDemo: true },
  { id: "d4", title: "स्टील डिनर सेट (24 पीस)", price: 1200, cat: "ghar", sellerName: "रमेश भाई", sellerArea: "गाँधी चौक", dist: "1.4 किमी", img: "https://images.unsplash.com/photo-1584346133934-a3a9c893a5d7?w=400&q=60", isDemo: true },
];

const PAGE_SIZE = 24;
const CACHE_TTL_MS = 2 * 60 * 1000;

let activeCategory = "sab";
let searchText = "";
let sortMode = "relevant";
let listings = [];
let currentUser = null;
let orderTargetItem = null;
let myWishlistIds = new Set();
let myLat = null;
let myLng = null;
let lastVisibleDoc = null;
let hasMoreProducts = true;
let sellerCache = {};

function readCache(key) {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.time > CACHE_TTL_MS) return null;
    return parsed.data;
  } catch (e) {
    return null;
  }
}
function writeCache(key, data) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ time: Date.now(), data }));
  } catch (e) {}
}

function renderWelcomeBanner() {
  const box = document.getElementById("welcomeBanner");
  const hour = new Date().getHours();
  let greetingKey = "greetingDay";
  if (hour < 12) greetingKey = "greetingMorning";
  else if (hour < 17) greetingKey = "greetingDay";
  else greetingKey = "greetingEvening";

  box.innerHTML = `
    <div class="welcome-text">
      <div class="welcome-greeting">${window.i18n.t(greetingKey)}</div>
      <div class="welcome-sub">${window.i18n.t("welcomeSub")}</div>
    </div>
  `;
}

function renderSkeleton() {
  const grid = document.getElementById("productGrid");
  let html = "";
  for (let i = 0; i < 6; i++) {
    html += `
      <div class="card skeleton-card">
        <div class="skeleton-img"></div>
        <div class="card-body">
          <div class="skeleton-line" style="width:80%"></div>
          <div class="skeleton-line" style="width:40%; margin-top:8px;"></div>
        </div>
      </div>`;
  }
  grid.innerHTML = html;
}

function getMyLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        myLat = pos.coords.latitude;
        myLng = pos.coords.longitude;
        resolve();
      },
      () => resolve(),
      { timeout: 5000 }
    );
  });
}

function calcDistanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function formatDistance(km) {
  if (km < 1) return `${Math.round(km * 1000)} मीटर`;
  return `${km.toFixed(1)} किमी`;
}

async function fetchSellersBatched(sellerIds) {
  const idsToFetch = sellerIds.filter((id) => !sellerCache[id]);
  const chunks = [];
  for (let i = 0; i < idsToFetch.length; i += 10) {
    chunks.push(idsToFetch.slice(i, i + 10));
  }
  await Promise.all(
    chunks.map(async (chunk) => {
      if (chunk.length === 0) return;
      try {
        const q = query(collection(db, "sellers"), where(documentId(), "in", chunk));
        const snap = await getDocs(q);
        snap.docs.forEach((d) => { sellerCache[d.id] = d.data(); });
      } catch (e) {
        console.error(e);
      }
    })
  );
  return sellerIds.map((id) => sellerCache[id]).filter(Boolean);
}

function mapProductToListing(p, id) {
  const seller = sellerCache[p.sellerId];
  return {
    id,
    title: p.name + (p.unit ? ` (${p.unit})` : ""),
    price: p.price,
    cat: p.cat,
    unitLabel: p.unit,
    sellerId: p.sellerId,
    sellerName: seller ? seller.shopName : "दुकान (प्रोफाइल अधूरी)",
    sellerArea: seller ? [seller.village, seller.district].filter(Boolean).join(", ") : "",
    sellerPhone: seller ? seller.phone : "",
    sellerLogo: seller ? seller.logo : null,
    sellerUpi: seller ? seller.upiId : "",
    isPremiumSeller: seller ? !!seller.isPremium : false,
    dist: (myLat && seller && seller.lat)
      ? formatDistance(calcDistanceKm(myLat, myLng, seller.lat, seller.lng))
      : "आपके आसपास",
    img: (p.images && p.images[0]) || p.img || null,
    images: p.images && p.images.length ? p.images : (p.img ? [p.img] : []),
    stock: p.stock,
    unit: p.unit,
    featured: p.featured,
    createdAt: p.createdAt || 0,
    isMine: currentUser && p.sellerId === currentUser.uid,
    isDemo: false,
  };
}

async function loadFirstPage() {
  const cached = readCache("homeProducts");
  if (cached) {
    listings = [...cached.listings, ...demoListings];
    sellerCache = { ...sellerCache, ...cached.sellerCache };
    hasMoreProducts = cached.hasMore;
    return;
  }

  const q = query(collection(db, "products"), orderBy("createdAt", "desc"), limit(PAGE_SIZE));
  const snap = await getDocs(q);
  const products = snap.docs.map((d) => ({ docId: d.id, ...d.data() }));
  lastVisibleDoc = snap.docs[snap.docs.length - 1] || null;
  hasMoreProducts = snap.docs.length === PAGE_SIZE;

  const sellerIds = [...new Set(products.map((p) => p.sellerId))];
  await fetchSellersBatched(sellerIds);

  const fromFirebase = products.map((p) => mapProductToListing(p, p.docId));
  listings = [...fromFirebase, ...demoListings];

  writeCache("homeProducts", {
    listings: fromFirebase,
    sellerCache,
    hasMore: hasMoreProducts,
  });
}

async function loadNextPage() {
  if (!lastVisibleDoc) return;
  const q = query(collection(db, "products"), orderBy("createdAt", "desc"), startAfter(lastVisibleDoc), limit(PAGE_SIZE));
  const snap = await getDocs(q);
  const products = snap.docs.map((d) => ({ docId: d.id, ...d.data() }));
  lastVisibleDoc = snap.docs[snap.docs.length - 1] || null;
  hasMoreProducts = snap.docs.length === PAGE_SIZE;

  const sellerIds = [...new Set(products.map((p) => p.sellerId))];
  await fetchSellersBatched(sellerIds);

  const newItems = products.map((p) => mapProductToListing(p, p.docId));
  listings = [...listings.filter((l) => !l.isDemo), ...newItems, ...demoListings];
}

async function loadFamousSellers() {
  try {
    const q = query(collection(db, "sellers"), where("isPremium", "==", true), limit(10));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error(err);
    return [];
  }
}

function renderFamousSellers(sellersList) {
  const row = document.getElementById("famousSellersRow");
  if (!sellersList.length) {
    row.innerHTML = `<p class="empty-note">${window.i18n.t("famousSellersEmpty")}</p>`;
    return;
  }
  row.innerHTML = "";
  sellersList.forEach((s) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "seller-mini-card";
    const logo = s.logo || "https://placehold.co/120x120/E8A33D/1B2A4A?text=🏪";
    const area = [s.village, s.district].filter(Boolean).join(", ");
    btn.innerHTML = `
      <img src="${logo}" alt="${s.shopName}">
      <div class="seller-mini-name">${s.shopName || "दुकान"}</div>
      <div class="seller-mini-area">${area || "आपके आसपास"}</div>
    `;
    btn.addEventListener("click", () => {
      window.location.href = `shop.html?sellerId=${s.id}`;
    });
    row.appendChild(btn);
  });
}

function renderCategories() {
  const wrap = document.getElementById("categories");
  wrap.innerHTML = "";
  categories.forEach((cat) => {
    const btn = document.createElement("button");
    btn.className = "cat-btn" + (cat.id === activeCategory ? " active" : "");
    btn.innerHTML = `<span class="emoji">${cat.emoji}</span><span>${cat.label}</span>`;
    btn.addEventListener("click", () => {
      activeCategory = cat.id;
      renderCategories();
      renderProducts();
    });
    wrap.appendChild(btn);
  });
}

function renderProducts() {
  const grid = document.getElementById("productGrid");
  grid.innerHTML = "";

  const cleanSearch = searchText.trim().toLowerCase();

  let filtered = listings.filter((item) => {
    const matchCat = activeCategory === "sab" || item.cat === activeCategory;
    if (!cleanSearch) return matchCat;
    const catLabel = (categories.find((c) => c.id === item.cat) || {}).label || "";
    const searchableText = [item.title, item.sellerName, catLabel, item.sellerArea].join(" ").toLowerCase();
    return matchCat && searchableText.includes(cleanSearch);
  });

  if (sortMode === "price_low") filtered = [...filtered].sort((a, b) => a.price - b.price);
  else if (sortMode === "price_high") filtered = [...filtered].sort((a, b) => b.price - a.price);
  else if (sortMode === "newest") filtered = [...filtered].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  else filtered = [...filtered].sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));

  document.getElementById("loadMoreBtn").style.display = (hasMoreProducts && activeCategory === "sab" && !cleanSearch) ? "block" : "none";

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-emoji">🔍</div>
        <p class="empty-state-title">${window.i18n.t("emptySearchTitle")}</p>
        <p class="empty-state-sub">${window.i18n.t("emptySearchSub")}</p>
      </div>`;
    return;
  }

  const frag = document.createDocumentFragment();
  filtered.forEach((item) => {
    const card = document.createElement("div");
    card.className = "card";
    const imgSrc = item.img || "https://placehold.co/400x300/EDE4D3/1B2A4A?text=📦";
    const isWishlisted = myWishlistIds.has(item.id);
    card.innerHTML = `
      <img src="${imgSrc}" alt="${item.title}" loading="lazy">
      <span class="dist-badge">📍 ${item.dist}</span>
      ${item.featured ? '<span class="card-featured-tag">⭐ फीचर्ड</span>' : ""}
      ${!item.isDemo && !item.isMine ? `<button class="wishlist-heart ${isWishlisted ? "active" : ""}" data-id="${item.id}">${isWishlisted ? "❤️" : "🤍"}</button>` : ""}
      <div class="card-body">
        <div class="card-title">${item.title}</div>
        <div class="card-price">₹${item.price}</div>
        <div class="card-seller">🏬 ${item.sellerName} ${item.sellerArea ? "· " + item.sellerArea : ""}</div>
      </div>`;
    card.addEventListener("click", () => openDetail(item));
    const heartBtn = card.querySelector(".wishlist-heart");
    if (heartBtn) {
      heartBtn.addEventListener("click", (e) => { e.stopPropagation(); toggleWishlist(item); });
    }
    frag.appendChild(card);
  });
  grid.appendChild(frag);
}

async function fetchSellerRating(sellerId) {
  const cacheKey = "rating_" + sellerId;
  const cached = readCache(cacheKey);
  if (cached) return cached;

  try {
    const q = query(collection(db, "reviews"), where("sellerId", "==", sellerId));
    const snap = await getDocs(q);
    const reviews = snap.docs.map((d) => d.data());
    const result = reviews.length > 0
      ? { avg: (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1), count: reviews.length }
      : { avg: null, count: 0 };
    writeCache(cacheKey, result);
    return result;
  } catch (e) {
    return { avg: null, count: 0 };
  }
}

async function openDetail(item) {
  const modal = document.getElementById("detailModal");
  const gallery = item.images && item.images.length ? item.images : [item.img || "https://placehold.co/400x300/EDE4D3/1B2A4A?text=📦"];
  const logoSrc = item.sellerLogo || "https://placehold.co/80x80/1B2A4A/FFFFFF?text=🏬";
  const orderButtonHtml = item.isDemo
    ? `<p style="text-align:center; font-size:12px; color:#999; margin-top:10px;">यह एक डेमो सामान है, इसे ऑर्डर नहीं किया जा सकता।</p>`
    : item.isMine
    ? `<p style="text-align:center; font-size:12px; color:#999; margin-top:10px;">यह आपकी अपनी दुकान का सामान है।</p>`
    : `
      <div class="detail-btn-row">
        <button class="btn-secondary-outline" id="addToCartBtn">${window.i18n.t("addToCart")}</button>
        <button class="btn-primary" id="startOrderBtn" style="margin-top:0;">${window.i18n.t("orderNow")}</button>
      </div>
    `;

  modal.innerHTML = `
    <div class="gallery-main-wrap">
      <img src="${gallery[0]}" alt="${item.title}" id="galleryMainImg" data-idx="0">
      ${gallery.length > 1 ? `<div class="gallery-dots">${gallery.map((_, i) => `<span class="gallery-dot ${i === 0 ? "active" : ""}" data-idx="${i}"></span>`).join("")}</div>` : ""}
    </div>
    <h2>${item.title}</h2>
    <div class="card-price" style="font-size:22px;">₹${item.price}</div>
    <div style="font-size:12px; color:#999; margin-top:4px;">📍 ${item.dist}</div>
    ${item.stock !== undefined ? `<div style="font-size:12px; color:${item.stock === 0 ? "#C0392B" : "#2E7D4F"}; margin-top:2px;">
      ${item.stock === 0 ? "❌ स्टॉक खत्म" : `✅ ${item.stock} ${item.unit || ""} उपलब्ध`}
    </div>` : ""}

    <div class="seller-box">
      <img class="seller-avatar-img" src="${logoSrc}" alt="shop logo">
      <div class="seller-info">
        <div class="seller-name">${item.sellerName} ${item.isPremiumSeller ? '<span class="verified-badge">✔️ वेरिफाइड</span>' : ""}</div>
        <div id="ratingSlot"></div>
        <div class="seller-area">📍 ${item.sellerArea || "इलाका उपलब्ध नहीं"}</div>
      </div>
    </div>

    ${orderButtonHtml}
    ${!item.isDemo && !item.isMine ? `<a href="chat.html?sellerId=${item.sellerId}&sellerName=${encodeURIComponent(item.sellerName)}" class="shop-link-btn">💬 विक्रेता से चैट करें</a>` : ""}
    ${item.isMine ? `<a href="seller-profile.html" class="shop-link-btn">🏬 दुकान की पूरी प्रोफाइल देखें</a>` : ""}
    <button class="btn-secondary" id="closeDetail">${window.i18n.t("closeBtn")}</button>
  `;
  document.getElementById("detailOverlay").classList.add("show");
  document.getElementById("closeDetail").addEventListener("click", closeDetail);

  const orderBtn = document.getElementById("startOrderBtn");
  if (orderBtn) orderBtn.addEventListener("click", () => startOrder(item));
  const cartBtn = document.getElementById("addToCartBtn");
  if (cartBtn) cartBtn.addEventListener("click", () => addToCart(item));

  const mainImg = document.getElementById("galleryMainImg");
  mainImg.addEventListener("click", () => openZoom(gallery, Number(mainImg.dataset.idx)));
  document.querySelectorAll(".gallery-dot").forEach((dot) => {
    dot.addEventListener("click", () => {
      const idx = Number(dot.dataset.idx);
      mainImg.src = gallery[idx];
      mainImg.dataset.idx = idx;
      document.querySelectorAll(".gallery-dot").forEach((d) => d.classList.remove("active"));
      dot.classList.add("active");
    });
  });

  if (!item.isDemo) {
    fetchSellerRating(item.sellerId).then((r) => {
      const slot = document.getElementById("ratingSlot");
      if (slot && r.count > 0) {
        slot.innerHTML = `<div class="rating-badge" style="margin-top:4px;">⭐ ${r.avg} (${r.count})</div>`;
      }
    });
  }
}

function openZoom(gallery, startIdx) {
  const overlay = document.getElementById("zoomOverlay");
  const img = document.getElementById("zoomImg");
  img.src = gallery[startIdx];
  overlay.classList.add("show");
}

function closeDetail() {
  document.getElementById("detailOverlay").classList.remove("show");
}

async function fetchWishlist() {
  if (!currentUser) return new Set();
  const snap = await getDoc(doc(db, "wishlists", currentUser.uid));
  return snap.exists() && snap.data().productIds ? new Set(snap.data().productIds) : new Set();
}

async function toggleWishlist(item) {
  if (!currentUser) {
    alert("पसंद में डालने के लिए पहले लॉगिन करना ज़रूरी है।");
    window.location.href = "login.html?next=index.html";
    return;
  }
  const isWishlisted = myWishlistIds.has(item.id);
  try {
    if (isWishlisted) {
      await setDoc(doc(db, "wishlists", currentUser.uid), { productIds: arrayRemove(item.id) }, { merge: true });
      myWishlistIds.delete(item.id);
    } else {
      await setDoc(doc(db, "wishlists", currentUser.uid), { productIds: arrayUnion(item.id) }, { merge: true });
      myWishlistIds.add(item.id);
    }
    renderProducts();
  } catch (err) {
    console.error(err);
    alert("दिक्कत आई, दोबारा कोशिश करें।");
  }
}

async function addToCart(item) {
  if (!currentUser) {
    alert("कार्ट में डालने के लिए पहले लॉगिन करना ज़रूरी है।");
    window.location.href = "login.html?next=index.html";
    return;
  }
  const cartItem = {
    productId: item.id, title: item.title, price: item.price, unit: item.unit || "",
    img: item.img || null, sellerId: item.sellerId, sellerName: item.sellerName, qty: 1,
  };
  try {
    await setDoc(doc(db, "carts", currentUser.uid), { items: arrayUnion(cartItem) }, { merge: true });
    alert("✅ सामान कार्ट में डाल दिया गया!");
    closeDetail();
  } catch (err) {
    console.error(err);
    alert("कार्ट में डालने में दिक्कत आई।");
  }
}

function showPaymentPopup(item, orderId, amount) {
  const qrBox = document.getElementById("qrSection");
  const markPaidBtn = document.getElementById("markPaidBtn");
  if (item.sellerUpi) {
    const upiLink = `upi://pay?pa=${encodeURIComponent(item.sellerUpi)}&pn=${encodeURIComponent(item.sellerName)}&am=${amount}&cu=INR`;
    const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(upiLink)}`;
    qrBox.innerHTML = `
      <img src="${qrImgUrl}" alt="UPI QR" style="width:200px; height:200px; border-radius:10px; margin:10px 0;">
      <p style="font-size:12px; color:#555;">UPI ID: <b>${item.sellerUpi}</b><br>राशि: ₹${amount}</p>`;
    markPaidBtn.style.display = "block";
    markPaidBtn.onclick = async () => {
      await updateDoc(doc(db, "orders", orderId), { paymentStatus: "buyer_marked_paid" });
      alert("धन्यवाद! विक्रेता को पैसा मिलने की पुष्टि करने के लिए सूचित कर दिया गया है।");
      closePaymentPopup();
    };
  } else {
    qrBox.innerHTML = `<p class="premium-hint">इस विक्रेता ने अभी UPI ID नहीं जोड़ी है। सामान मिलने पर नकद भुगतान करें।</p>`;
    markPaidBtn.style.display = "none";
  }
  document.getElementById("paymentOverlay").classList.add("show");
}
function closePaymentPopup() {
  document.getElementById("paymentOverlay").classList.remove("show");
}

function startOrder(item) {
  if (!currentUser) {
    alert("ऑर्डर करने के लिए पहले लॉगिन करना ज़रूरी है।");
    window.location.href = "login.html?next=index.html";
    return;
  }
  orderTargetItem = item;
  closeDetail();
  document.getElementById("orderProductName").textContent = `${item.title} — ₹${item.price} प्रति ${item.unit || "यूनिट"}`;
  document.getElementById("orderQty").value = 1;
  document.getElementById("orderOverlay").classList.add("show");
}

function closeOrderForm() {
  document.getElementById("orderOverlay").classList.remove("show");
  orderTargetItem = null;
}

async function handleOrderSubmit(e) {
  e.preventDefault();
  if (!orderTargetItem || !currentUser) return;
  const btn = document.getElementById("orderSubmitBtn");
  btn.disabled = true;
  btn.textContent = "भेजा जा रहा है...";

  const qty = Number(document.getElementById("orderQty").value);
  const name = document.getElementById("orderName").value;
  const phone = document.getElementById("orderPhone").value;
  const address = document.getElementById("orderAddress").value;
  const note = document.getElementById("orderNote").value;

  const order = {
    productId: orderTargetItem.id, productName: orderTargetItem.title, productImg: orderTargetItem.img || null,
    price: orderTargetItem.price, unit: orderTargetItem.unit || "", quantity: qty, totalAmount: orderTargetItem.price * qty,
    sellerId: orderTargetItem.sellerId,
    sellerName: orderTargetItem.sellerName,
    buyerId: currentUser.uid,
    buyerName: name,
    buyerPhone: phone,
    deliveryAddress: address,
    note: note,
    status: "pending",
    createdAt: Date.now(),
  };

  try {
    const docRef = await addDoc(collection(db, "orders"), order);
    closeOrderForm();
    showPaymentPopup(orderTargetItem, docRef.id, order.totalAmount);
  } catch (err) {
    console.error(err);
    alert("ऑर्डर भेजने में दिक्कत आई। दोबारा कोशिश करें।");
  } finally {
    btn.disabled = false;
    btn.textContent = "ऑर्डर भेजें";
  }
}

// ---------- Static UI wiring ----------

document.getElementById("orderForm").addEventListener("submit", handleOrderSubmit);
document.getElementById("cancelOrder").addEventListener("click", closeOrderForm);
document.getElementById("closePaymentPopup").addEventListener("click", closePaymentPopup);

document.getElementById("zoomCloseBtn").addEventListener("click", () => {
  document.getElementById("zoomOverlay").classList.remove("show");
});
document.getElementById("zoomOverlay").addEventListener("click", (e) => {
  if (e.target.id === "zoomOverlay") e.currentTarget.classList.remove("show");
});

document.getElementById("menuBtn").addEventListener("click", () => {
  document.getElementById("sideMenuOverlay").classList.add("show");
});
document.getElementById("closeMenuBtn").addEventListener("click", () => {
  document.getElementById("sideMenuOverlay").classList.remove("show");
});
document.getElementById("sideMenuOverlay").addEventListener("click", (e) => {
  if (e.target.id === "sideMenuOverlay") e.currentTarget.classList.remove("show");
});

function goToProtectedPage(page) {
  if (!currentUser) {
    window.location.href = `login.html?next=${encodeURIComponent(page)}`;
  } else {
    window.location.href = page;
  }
}
document.getElementById("wishlistMenuLink").addEventListener("click", (e) => {
  e.preventDefault();
  goToProtectedPage("wishlist.html");
});
document.getElementById("ordersMenuLink").addEventListener("click", (e) => {
  e.preventDefault();
  goToProtectedPage("my-orders.html");
});
document.getElementById("accountMenuLink").addEventListener("click", (e) => {
  e.preventDefault();
  goToProtectedPage("my-orders.html");
});

document.getElementById("authLink").addEventListener("click", async (e) => {
  e.preventDefault();
  if (currentUser) {
    await signOut(auth);
    window.location.reload();
  } else {
    window.location.href = "login.html?next=index.html";
  }
});

document.getElementById("langToggleBtn").addEventListener("click", () => {
  const newLang = window.i18n.getLang() === "hi" ? "en" : "hi";
  window.i18n.setLang(newLang);
  window.i18n.applyTranslations();
  renderWelcomeBanner();
  renderProducts();
});

let searchDebounceTimer = null;
document.getElementById("searchInput").addEventListener("input", (e) => {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    searchText = e.target.value;
    renderProducts();
  }, 250);
});

document.getElementById("sortSelect").addEventListener("change", (e) => {
  sortMode = e.target.value;
  renderProducts();
});

document.getElementById("loadMoreBtn").addEventListener("click", async () => {
  const btn = document.getElementById("loadMoreBtn");
  btn.disabled = true;
  btn.textContent = "लोड हो रहा है...";
  try {
    await loadNextPage();
    renderProducts();
  } catch (err) {
    console.error(err);
  } finally {
    btn.disabled = false;
    btn.textContent = "और सामान दिखाएँ";
  }
});

// ---------- Init ----------

window.i18n.applyTranslations();
renderWelcomeBanner();
renderSkeleton();
renderCategories();

loadFamousSellers().then(renderFamousSellers);

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  const authLink = document.getElementById("authLink");
  authLink.textContent = user ? "लॉगआउट" : window.i18n.t("login");

  if (user) {
    try {
      myWishlistIds = await fetchWishlist();
    } catch (err) {
      console.error(err);
    }
  } else {
    myWishlistIds = new Set();
  }

  try {
    await getMyLocation();
    await loadFirstPage();
  } catch (err) {
    console.error(err);
    listings = [...demoListings];
  }

  renderProducts();
});
