const db = window.firebaseDB;
const { collection, doc, getDoc, getDocs } = window.firebaseTools;
const myDeviceId = localStorage.getItem("myDeviceSellerId") || "";

const categories = [
  { id: "sab", label: "सब कुछ", emoji: "🏪" },
  { id: "sabzi", label: "सब्ज़ी-राशन", emoji: "🥕" },
  { id: "kapde", label: "कपड़े", emoji: "👕" },
  { id: "ghar", label: "घरेलू सामान", emoji: "🛋️" },
  { id: "electronics", label: "इलेक्ट्रॉनिक्स", emoji: "🔌" },
  { id: "handmade", label: "हस्तशिल्प", emoji: "🧶" },
];

const demoListings = [
  { id: "d1", title: "ताज़ा देसी टमाटर (1 किलो)", price: 40, cat: "sabzi", sellerName: "सुनीता जी", sellerArea: "शास्त्री नगर", dist: "350 मीटर", img: "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=400&q=60", isMine: false },
  { id: "d2", title: "हाथ से बुना ऊनी शॉल", price: 850, cat: "handmade", sellerName: "अजय हैंडीक्राफ्ट", sellerArea: "मॉडल टाउन", dist: "2.1 किमी", img: "https://images.unsplash.com/photo-1520903920243-00d872a2d1c9?w=400&q=60", isMine: false },
  { id: "d3", title: "कॉटन कुर्ती (M साइज़)", price: 320, cat: "kapde", sellerName: "प्रिया स्टोर्स", sellerArea: "नेहरू कॉलोनी", dist: "900 मीटर", img: "https://images.unsplash.com/photo-1583391733956-6c78276477e2?w=400&q=60", isMine: false },
  { id: "d4", title: "स्टील डिनर सेट (24 पीस)", price: 1200, cat: "ghar", sellerName: "रमेश भाई", sellerArea: "गाँधी चौक", dist: "1.4 किमी", img: "https://images.unsplash.com/photo-1584346133934-a3a9c893a5d7?w=400&q=60", isMine: false },
];

let activeCategory = "sab";
let searchText = "";
let listings = [];

// ===== Firebase से सारा सामान + दुकानदारों की जानकारी लाना =====
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
      sellerName: seller ? seller.shopName : "दुकान (प्रोफाइल अधूरी)",
      sellerArea: seller ? [seller.village, seller.district].filter(Boolean).join(", ") : "",
      sellerPhone: seller ? seller.phone : "",
      sellerLogo: seller ? seller.logo : null,
      sellerShopId: seller ? seller.shopId : "",
      sellerShopId: seller ? seller.shopId : "",
      isPremiumSeller: seller ? !!seller.isPremium : false,
      dist: "आपके आसपास",
      img: p.img || null,
      stock: p.stock,
      unit: p.unit,
      featured: p.featured,
      isMine: p.sellerId === myDeviceId,
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

    <button class="btn-primary">📞 विक्रेता से बात करें ${item.sellerPhone ? "(" + item.sellerPhone + ")" : ""}</button>
    ${item.isMine ? `<a href="seller-profile.html" class="shop-link-btn">🏬 दुकान की पूरी प्रोफाइल देखें</a>` : ""}
    <p style="text-align:center; font-size:11px; color:#999; margin-top:8px;">
      यह डेमो है — असली ऐप में यहाँ चैट/कॉल खुलेगा
    </p>
    <button class="btn-secondary" id="closeDetail">बंद करें</button>
  `;
  document.getElementById("detailOverlay").classList.add("show");
  document.getElementById("closeDetail").addEventListener("click", closeDetail);
}

function closeDetail() {
  document.getElementById("detailOverlay").classList.remove("show");
}

function fillCategoryDropdown() {
  const select = document.getElementById("itemCat");
  select.innerHTML = "";
  categories.filter((c) => c.id !== "sab").forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = `${c.emoji} ${c.label}`;
    select.appendChild(opt);
  });
}

function openPostForm() { document.getElementById("postOverlay").classList.add("show"); }
function closePostForm() { document.getElementById("postOverlay").classList.remove("show"); }

function handlePostSubmit(e) {
  e.preventDefault();
  alert("यह क्विक बटन अब बंद है — कृपया 'विक्रेता डैशबोर्ड' से जाकर सामान जोड़ें, ताकि वह असली सूची में सेव हो।");
  closePostForm();
}

function handleSearch(e) {
  searchText = e.target.value;
  renderProducts();
}

document.getElementById("searchInput").addEventListener("input", handleSearch);
document.getElementById("postBtn").addEventListener("click", openPostForm);
document.getElementById("cancelPost").addEventListener("click", closePostForm);
document.getElementById("postForm").addEventListener("submit", handlePostSubmit);
document.getElementById("detailOverlay").addEventListener("click", function (e) { if (e.target === this) closeDetail(); });
document.getElementById("postOverlay").addEventListener("click", function (e) { if (e.target === this) closePostForm(); });

async function init() {
  document.getElementById("productGrid").innerHTML = `<p style="grid-column:1/-1; text-align:center; color:#999; padding:30px 0;">लोड हो रहा है...</p>`;
  fillCategoryDropdown();
  await loadListings();
  renderCategories();
  renderProducts();
}

init();
