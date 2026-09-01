const db = window.firebaseDB;
const auth = window.firebaseAuth;
const { collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc, arrayUnion, arrayRemove, query, where } = window.firebaseTools;
const { onAuthStateChanged } = window.authTools;

const params = new URLSearchParams(window.location.search);
const sellerId = params.get("sellerId");

let currentUser = null;
let sellerData = null;
let isFollowing = false;
let shopProducts = [];
let searchText = "";
let orderTargetItem = null;
const CACHE_TTL_MS = 2 * 60 * 1000;

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

function getMySellerId() {
  return sellerId;
}

async function fetchRatingInfo() {
  const q = query(collection(db, "reviews"), where("sellerId", "==", sellerId));
  const snap = await getDocs(q);
  const reviews = snap.docs.map((d) => d.data());
  if (reviews.length === 0) return { avg: 0, count: 0 };
  const total = reviews.reduce((s, r) => s + (r.rating || 0), 0);
  return { avg: (total / reviews.length).toFixed(1), count: reviews.length };
}

function renderStorefront(p, ratingInfo, productCount) {
  const box = document.getElementById("storefrontBox");
  const premium = !!p.isPremium;
  const banner = p.banner || "https://placehold.co/600x200/1B2A4A/FFFFFF?text=दुकान+की+फोटो";
  const logo = p.logo || "https://placehold.co/120x120/E8A33D/1B2A4A?text=🏪";
  const addressLine = [p.village, p.tehsil, p.district, p.state].filter(Boolean).join(", ");

  box.innerHTML = `
    <div class="storefront-banner" style="background-image:url('${banner}')"></div>
    <div class="storefront-body">
      <img class="storefront-logo" src="${logo}" alt="logo">
      <div class="storefront-info">
        <div class="storefront-name">${p.shopName || "दुकान"} ${premium ? '<span class="verified-badge">✔️ वेरिफाइड</span>' : ""}</div>
        <div class="storefront-owner">👤 ${p.ownerName || ""}</div>
        <div class="storefront-area">📍 ${addressLine}${p.pincode ? " — " + p.pincode : ""}</div>
      </div>
    </div>
    ${p.shopId ? `<div class="shop-id-badge">🆔 शॉप आईडी: <b>${p.shopId}</b></div>` : ""}
    ${ratingInfo.count > 0
      ? `<div class="rating-badge">⭐ ${ratingInfo.avg} (${ratingInfo.count} रिव्यू)</div>`
      : `<div class="rating-badge rating-none">अभी कोई रिव्यू नहीं</div>`}
    ${p.description ? `<p class="storefront-desc">${p.description}</p>` : ""}
    ${p.fullAddress ? `<div class="storefront-address-box"><span>🏠 पूरा पता:</span> ${p.fullAddress}</div>` : ""}
    <div class="storefront-stats">
      <div><b>${productCount}</b><span>सामान लिस्टेड</span></div>
      <div><b>${p.joinedLabel || "-"}</b><span>से सदस्य</span></div>
      <div><b>${premium ? "⭐ प्रीमियम" : "मुफ़्त"}</b><span>प्लान</span></div>
    </div>
    <div class="storefront-contact">📞 ${p.phone || "-"}</div>
  `;
}

function renderFollowBtn() {
  const btn = document.getElementById("shopFollowBtn");
  btn.className = "follow-btn" + (isFollowing ? " following" : "");
  btn.textContent = isFollowing ? window.i18n.t("followingBtn") : window.i18n.t("followBtn");
}

async function toggleFollow() {
  if (!currentUser) {
    alert(window.i18n.t("loginToFollow"));
    window.location.href = `login.html?next=${encodeURIComponent("shop.html?sellerId=" + sellerId)}`;
    return;
  }
  try {
    if (isFollowing) {
      await setDoc(doc(db, "follows", currentUser.uid), { sellerIds: arrayRemove(sellerId) }, { merge: true });
      isFollowing = false;
    } else {
      await setDoc(doc(db, "follows", currentUser.uid), { sellerIds: arrayUnion(sellerId) }, { merge: true });
      isFollowing = true;
    }
    renderFollowBtn();
  } catch (err) {
    console.error(err);
    alert("दिक्कत आई, दोबारा कोशिश करें।");
  }
}

function mapProductToListing(p, id) {
  return {
    id,
    title: p.name + (p.unit ? ` (${p.unit})` : ""),
    price: p.price,
    sellerId: sellerId,
    sellerName: sellerData.shopName,
    sellerUpi: sellerData.upiId || "",
    sellerLogo: sellerData.logo || null,
    isPremiumSeller: !!sellerData.isPremium,
    img: (p.images && p.images[0]) || p.img || null,
    images: p.images && p.images.length ? p.images : (p.img ? [p.img] : []),
    stock: p.stock,
    unit: p.unit,
    featured: p.featured,
    isMine: currentUser && sellerId === currentUser.uid,
  };
}

async function loadShopProducts() {
  const q = query(collection(db, "products"), where("sellerId", "==", sellerId));
  const snap = await getDocs(q);
  shopProducts = snap.docs.map((d) => mapProductToListing(d.data(), d.id));
}

function renderProducts() {
  const grid = document.getElementById("shopProductGrid");
  const cleanSearch = searchText.trim().toLowerCase();
  const filtered = cleanSearch
    ? shopProducts.filter((p) => p.title.toLowerCase().includes(cleanSearch))
    : shopProducts;

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-emoji">📦</div>
        <p class="empty-state-title">${window.i18n.t("shopEmptyProducts")}</p>
      </div>`;
    return;
  }

  grid.innerHTML = "";
  const frag = document.createDocumentFragment();
  filtered.forEach((item) => {
    const card = document.createElement("div");
    card.className = "card";
    const imgSrc = item.img || "https://placehold.co/400x300/EDE4D3/1B2A4A?text=📦";
    card.innerHTML = `
      <img src="${imgSrc}" alt="${item.title}" loading="lazy">
      ${item.featured ? '<span class="card-featured-tag">⭐ फीचर्ड</span>' : ""}
      <div class="card-body">
        <div class="card-title">${item.title}</div>
        <div class="card-price">₹${item.price}</div>
      </div>`;
    card.addEventListener("click", () => openDetail(item));
    frag.appendChild(card);
  });
  grid.appendChild(frag);
}

async function openDetail(item) {
  const modal = document.getElementById("detailModal");
  const gallery = item.images && item.images.length ? item.images : [item.img || "https://placehold.co/400x300/EDE4D3/1B2A4A?text=📦"];
  const logoSrc = item.sellerLogo || "https://placehold.co/80x80/1B2A4A/FFFFFF?text=🏬";
  const orderButtonHtml = item.isMine
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
    ${item.stock !== undefined ? `<div style="font-size:12px; color:${item.stock === 0 ? "#C0392B" : "#2E7D4F"}; margin-top:2px;">
      ${item.stock === 0 ? "❌ स्टॉक खत्म" : `✅ ${item.stock} ${item.unit || ""} उपलब्ध`}
    </div>` : ""}

    <div class="seller-box">
      <img class="seller-avatar-img" src="${logoSrc}" alt="shop logo">
      <div class="seller-info">
        <div class="seller-name">${item.sellerName} ${item.isPremiumSeller ? '<span class="verified-badge">✔️ वेरिफाइड</span>' : ""}</div>
      </div>
    </div>

    ${orderButtonHtml}
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

async function addToCart(item) {
  if (!currentUser) {
    alert("कार्ट में डालने के लिए पहले लॉगिन करना ज़रूरी है।");
    window.location.href = `login.html?next=${encodeURIComponent("shop.html?sellerId=" + sellerId)}`;
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

function startOrder(item) {
  if (!currentUser) {
    alert("ऑर्डर करने के लिए पहले लॉगिन करना ज़रूरी है।");
    window.location.href = `login.html?next=${encodeURIComponent("shop.html?sellerId=" + sellerId)}`;
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

// ---------- wiring ----------

document.getElementById("orderForm").addEventListener("submit", handleOrderSubmit);
document.getElementById("cancelOrder").addEventListener("click", closeOrderForm);
document.getElementById("closePaymentPopup").addEventListener("click", closePaymentPopup);

document.getElementById("zoomCloseBtn").addEventListener("click", () => {
  document.getElementById("zoomOverlay").classList.remove("show");
});
document.getElementById("zoomOverlay").addEventListener("click", (e) => {
  if (e.target.id === "zoomOverlay") e.currentTarget.classList.remove("show");
});
document.getElementById("detailOverlay").addEventListener("click", (e) => {
  if (e.target === e.currentTarget) closeDetail();
});

document.getElementById("shopFollowBtn").addEventListener("click", toggleFollow);

let searchDebounceTimer = null;
document.getElementById("shopSearchInput").addEventListener("input", (e) => {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    searchText = e.target.value;
    renderProducts();
  }, 250);
});

document.getElementById("langToggleBtn").addEventListener("click", () => {
  const newLang = window.i18n.getLang() === "hi" ? "en" : "hi";
  window.i18n.setLang(newLang);
  window.i18n.applyTranslations();
  renderFollowBtn();
  renderProducts();
});

// ---------- init ----------

window.i18n.applyTranslations();

async function init() {
  if (!sellerId) {
    document.getElementById("loadingBox").style.display = "none";
    document.getElementById("notFoundBox").style.display = "block";
    return;
  }

  try {
    const cacheKey = `shop_${sellerId}`;
    const cached = readCache(cacheKey);

    let ratingInfo;
    if (cached) {
      sellerData = cached.seller;
      shopProducts = cached.products;
      ratingInfo = cached.rating;
    } else {
      const sSnap = await getDoc(doc(db, "sellers", sellerId));
      if (!sSnap.exists()) {
        document.getElementById("loadingBox").style.display = "none";
        document.getElementById("notFoundBox").style.display = "block";
        return;
      }
      sellerData = sSnap.data();
      await loadShopProducts();
      ratingInfo = await fetchRatingInfo();
      writeCache(cacheKey, { seller: sellerData, products: shopProducts, rating: ratingInfo });
    }

    const chatLink = document.getElementById("shopChatLink");
    chatLink.href = `chat.html?sellerId=${sellerId}&sellerName=${encodeURIComponent(sellerData.shopName || "")}`;

    renderStorefront(sellerData, ratingInfo, shopProducts.length);
    renderFollowBtn();
    renderProducts();

    document.getElementById("loadingBox").style.display = "none";
    document.getElementById("shopContent").style.display = "block";
  } catch (err) {
    console.error(err);
    document.getElementById("loadingBox").style.display = "none";
    document.getElementById("notFoundBox").style.display = "block";
  }
}

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  if (user && sellerId) {
    try {
      const fSnap = await getDoc(doc(db, "follows", user.uid));
      const ids = fSnap.exists() && fSnap.data().sellerIds ? fSnap.data().sellerIds : [];
      isFollowing = ids.includes(sellerId);
      renderFollowBtn();
    } catch (err) {
      console.error(err);
    }
  }
});

init();
