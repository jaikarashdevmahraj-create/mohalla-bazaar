const db = window.firebaseDB;
const auth = window.firebaseAuth;
const { collection, doc, getDoc, getDocs, addDoc, setDoc, arrayUnion } = window.firebaseTools;
const { onAuthStateChanged, signOut } = window.authTools;

const categories = [
  { id: "sab", label: "सब कुछ", emoji: "🏪" },
  { id: "sabzi", label: "सब्ज़ी-राशन", emoji: "🥕" },
  { id: "kapde", label: "कपड़े", emoji: "👕" },
  { id: "ghar", label: "घरेलू सामान", emoji: "🛋️" },
  { id: "electronics", label: "इलेक्ट्रॉनिक्स", emoji: "🔌" },
  { id: "handmade", label: "हस्तशिल्प", emoji: "🧶" },
];

const demoListings = [
  { id: "d1", title: "ताज़ा देसी टमाटर (1 किलो)", price: 40, cat: "sabzi", sellerName: "सुनीता जी", sellerArea: "शास्त्री नगर", dist: "350 मीटर", img: "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=400&q=60", isDemo: true },
  { id: "d2", title: "हाथ से बुना ऊनी शॉल", price: 850, cat: "handmade", sellerName: "अजय हैंडीक्राफ्ट", sellerArea: "मॉडल टाउन", dist: "2.1 किमी", img: "https://images.unsplash.com/photo-1520903920243-00d872a2d1c9?w=400&q=60", isDemo: true },
  { id: "d3", title: "कॉटन कुर्ती (M साइज़)", price: 320, cat: "kapde", sellerName: "प्रिया स्टोर्स", sellerArea: "नेहरू कॉलोनी", dist: "900 मीटर", img: "https://images.unsplash.com/photo-1583391733956-6c78276477e2?w=400&q=60", isDemo: true },
  { id: "d4", title: "स्टील डिनर सेट (24 पीस)", price: 1200, cat: "ghar", sellerName: "रमेश भाई", sellerArea: "गाँधी चौक", dist: "1.4 किमी", img: "https://images.unsplash.com/photo-1584346133934-a3a9c893a5d7?w=400&q=60", isDemo: true },
];

let activeCategory = "sab";
let searchText = "";
let listings = [];
let currentUser = null;
let orderTargetItem = null;

async function loadListings() {
  const productsSnap = await getDocs(collection(db, "products"));
  const products = productsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const sellerIds = [...new Set(products.map((p) => p.sellerId))];
  const sellerMap = {};
  await Promise.all(
    sellerIds.map(async (sid) => {
      try {
        const s = await getDoc(doc(db, "sellers", sid));
        if (s.exists()) sellerMap[sid] = s.data();
      } catch (e) {}
    })
  );

  const fromFirebase = products.map((p) => {
    const seller = sellerMap[p.sellerId];
    return {
      id: p.id,
      title: p.name + (p.unit ? ` (${p.unit})` : ""),
      price: p.price,
      cat: p.cat,
      unitLabel: p.unit,
      sellerId: p.sellerId,
      sellerName: seller ? seller.shopName : "दुकान (प्रोफाइल अधूरी)",
      sellerArea: seller ? [seller.village, seller.district].filter(Boolean).join(", ") : "",
      sellerPhone: seller ? seller.phone : "",
      sellerLogo: seller ? seller.logo : null,
      isPremiumSeller: seller ? !!seller.isPremium : false,
      dist: "आपके आसपास",
      img: p.img || null,
      stock: p.stock,
      unit: p.unit,
      featured: p.featured,
      isMine: currentUser && p.sellerId === currentUser.uid,
      isDemo: false,
    };
  });

  listings = [...fromFirebase, ...demoListings].sort(
    (a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0)
  );
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
  const filtered = listings.filter((item) => {
    const matchCat = activeCategory === "sab" || item.cat === activeCategory;
    const matchSearch = item.title.toLowerCase().includes(searchText.toLowerCase());
    return matchCat && matchSearch;
  });

  if (filtered.length === 0) {
    grid.innerHTML = `<p style="grid-column:1/-1; text-align:center; color:#999; padding:30px 0;">इस श्रेणी में अभी कुछ नहीं मिला।</p>`;
    return;
  }

  filtered.forEach((item) => {
    const card = document.createElement("div");
    card.className = "card";
    const imgSrc = item.img || "https://placehold.co/400x300/EDE4D3/1B2A4A?text=📦";
    card.innerHTML = `
      <img src="${imgSrc}" alt="${item.title}">
      <span class="dist-badge">📍 ${item.dist}</span>
      ${item.featured ? '<span class="card-featured-tag">⭐ फीचर्ड</span>' : ""}
      <div class="card-body">
        <div class="card-title">${item.title}</div>
        <div class="card-price">₹${item.price}</div>
        <div class="card-seller">🏬 ${item.sellerName} ${item.sellerArea ? "· " + item.sellerArea : ""}</div>
      </div>`;
    card.addEventListener("click", () => openDetail(item));
    grid.appendChild(card);
  });
}

function openDetail(item) {
  const modal = document.getElementById("detailModal");
  const imgSrc = item.img || "https://placehold.co/400x300/EDE4D3/1B2A4A?text=📦";
  const logoSrc = item.sellerLogo || "https://placehold.co/80x80/1B2A4A/FFFFFF?text=🏬";

  const orderButtonHtml = item.isDemo
    ? `<p style="text-align:center; font-size:12px; color:#999; margin-top:10px;">यह एक डेमो सामान है, इसे ऑर्डर नहीं किया जा सकता।</p>`
    : item.isMine
    ? `<p style="text-align:center; font-size:12px; color:#999; margin-top:10px;">यह आपकी अपनी दुकान का सामान है।</p>`
    : `
      <div class="detail-btn-row">
        <button class="btn-secondary-outline" id="addToCartBtn">🛒 कार्ट में डालें</button>
        <button class="btn-primary" id="startOrderBtn" style="margin-top:0;">⚡ अभी ऑर्डर करें</button>
      </div>
    `;

  modal.innerHTML = `
    <img src="${imgSrc}" alt="${item.title}">
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
        <div class="seller-area">📍 ${item.sellerArea || "इलाका उपलब्ध नहीं"}</div>
      </div>
    </div>

    ${orderButtonHtml}
    ${item.isMine ? `<a href="seller-profile.html" class="shop-link-btn">🏬 दुकान की पूरी प्रोफाइल देखें</a>` : ""}
    <button class="btn-secondary" id="closeDetail">बंद करें</button>
  `;
  document.getElementById("detailOverlay").classList.add("show");
  document.getElementById("closeDetail").addEventListener("click", closeDetail);

  const orderBtn = document.getElementById("startOrderBtn");
  if (orderBtn) orderBtn.addEventListener("click", () => startOrder(item));

  const cartBtn = document.getElementById("addToCartBtn");
  if (cartBtn) cartBtn.addEventListener("click", () => addToCart(item));
}

function closeDetail() {
  document.getElementById("detailOverlay").classList.remove("show");
}

async function addToCart(item) {
  if (!currentUser) {
    alert("कार्ट में डालने के लिए पहले लॉगिन करना ज़रूरी है।");
    window.location.href = "login.html?next=index.html";
    return;
  }
  const cartItem = {
    productId: item.id,
    title: item.title,
    price: item.price,
    unit: item.unit || "",
    img: item.img || null,
    sellerId: item.sellerId,
    sellerName: item.sellerName,
    qty: 1,
  };
  try {
    await setDoc(doc(db, "carts", currentUser.uid), {
      items: arrayUnion(cartItem),
    }, { merge: true });
    alert("✅ सामान कार्ट में डाल दिया गया!");
    closeDetail();
  } catch (err) {
    console.error(err);
    alert("कार्ट में डालने में दिक्कत आई।");
  }
}

// ===== ऑर्डर फॉर्म शुरू करना =====
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
  const order = {
    productId: orderTargetItem.id,
    productName: orderTargetItem.title,
    productImg: orderTargetItem.img || null,
    price: orderTargetItem.price,
    unit: orderTargetItem.unit || "",
    quantity: qty,
    totalAmount: orderTargetItem.price * qty,
    sellerId: orderTargetItem.sellerId,
    sellerName: orderTargetItem.sellerName,
    buyerId: currentUser.uid,
    buyerName: document.getElementById("orderName").value,
    buyerPhone: document.getElementById("orderPhone").value,
    deliveryAddress: document.getElementById("orderAddress").value,
    note: document.getElementById("orderNote").value,
    status: "pending",
    createdAt: Date.now(),
  };

  try {
    await addDoc(collection(db, "orders"), order);
    alert("✅ आपका ऑर्डर भेज दिया गया है! विक्रेता के स्वीकार करने का इंतज़ार करें। आप 'मेरे ऑर्डर' पेज पर स्थिति देख सकते हैं।");
    closeOrderForm();
    document.getElementById("orderForm").reset();
  } catch (err) {
    console.error(err);
    alert("ऑर्डर भेजने में दिक्कत आई। दोबारा कोशिश करें।");
  } finally {
    btn.disabled = false;
    btn.textContent = "ऑर्डर भेजें";
  }
}

function handleSearch(e) {
  searchText = e.target.value;
  renderProducts();
}

function updateAuthLink() {
  const link = document.getElementById("authLink");
  const accountMenuLink = document.getElementById("accountMenuLink");
  const ordersMenuLink = document.getElementById("ordersMenuLink");

  if (currentUser) {
    link.textContent = "👤 खाता";
    link.href = "my-orders.html";
    accountMenuLink.textContent = "👤 मेरा अकाउंट (लॉगआउट)";
    accountMenuLink.href = "#";
    accountMenuLink.onclick = async (e) => {
      e.preventDefault();
      await signOut(auth);
      window.location.reload();
    };
    ordersMenuLink.href = "my-orders.html";
  } else {
    link.textContent = "लॉगिन";
    link.href = "login.html";
    accountMenuLink.textContent = "👤 लॉगिन / अकाउंट बनाएँ";
    accountMenuLink.href = "login.html";
    accountMenuLink.onclick = null;
    ordersMenuLink.href = "login.html?next=my-orders.html";
  }
}

function openSideMenu() {
  document.getElementById("sideMenuOverlay").classList.add("show");
}
function closeSideMenu() {
  document.getElementById("sideMenuOverlay").classList.remove("show");
}

document.getElementById("detailOverlay").addEventListener("click", function (e) { if (e.target === this) closeDetail(); });
document.getElementById("orderOverlay").addEventListener("click", function (e) { if (e.target === this) closeOrderForm(); });
document.getElementById("cancelOrder").addEventListener("click", closeOrderForm);
document.getElementById("orderForm").addEventListener("submit", handleOrderSubmit);
document.getElementById("menuBtn").addEventListener("click", openSideMenu);
document.getElementById("closeMenuBtn").addEventListener("click", closeSideMenu);
document.getElementById("sideMenuOverlay").addEventListener("click", (e) => {
  if (e.target === e.currentTarget) closeSideMenu();
});
document.getElementById("searchInput").addEventListener("input", handleSearch);

async function init() {
  document.getElementById("productGrid").innerHTML = `<p style="grid-column:1/-1; text-align:center; color:#999; padding:30px 0;">लोड हो रहा है...</p>`;
  await loadListings();
  renderCategories();
  renderProducts();
}

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  updateAuthLink();
  await init();
});
