// ===== डेमो सामान (हमेशा दिखने वाला सैंपल डेटा) =====
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
  { id: "d5", title: "टेबल फैन (नया)", price: 999, cat: "electronics", sellerName: "विकास इलेक्ट्रिकल्स", sellerArea: "स्टेशन रोड", dist: "1.8 किमी", img: "https://images.unsplash.com/photo-1617103996702-96ff29b1c467?w=400&q=60", isMine: false },
  { id: "d6", title: "अचार का सेट (मिक्स)", price: 180, cat: "sabzi", sellerName: "कमला दीदी", sellerArea: "शास्त्री नगर", dist: "500 मीटर", img: "https://images.unsplash.com/photo-1626200926749-24197f80f095?w=400&q=60", isMine: false },
];

let activeCategory = "sab";
let searchText = "";
let listings = [];

// ===== Seller Dashboard में जोड़ा गया सामान पढ़ना, और होमपेज के फॉर्मेट में बदलना =====
function loadMyProducts() {
  const raw = localStorage.getItem("mySellerProducts");
  const myProducts = raw ? JSON.parse(raw) : [];

  const profileRaw = localStorage.getItem("sellerProfile");
  const profile = profileRaw ? JSON.parse(profileRaw) : null;
  const isPremium = localStorage.getItem("isPremiumSeller") === "true";

  return myProducts.map((p) => ({
    id: "mine-" + p.id,
    title: p.name + (p.unit ? ` (${p.unit})` : ""),
    price: p.price,
    cat: p.cat,
    sellerName: profile ? profile.shopName : "आपकी दुकान (नाम अभी नहीं भरा)",
    sellerArea: profile ? profile.area : "प्रोफाइल में इलाका भरें",
    sellerPhone: profile ? profile.phone : "",
    sellerLogo: profile ? profile.logo : null,
    dist: "आपके पास",
    img: p.img || null,
    stock: p.stock,
    unit: p.unit,
    featured: p.featured,
    isMine: true,
    isPremiumSeller: isPremium,
  }));
}

// ===== सबको मिलाकर लिस्ट बनाना (फीचर्ड सबसे ऊपर) =====
function buildListings() {
  const mine = loadMyProducts();
  listings = [...mine, ...demoListings].sort(
    (a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0)
  );
}

// ===== श्रेणियाँ दिखाना =====
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

// ===== प्रोडक्ट कार्ड्स दिखाना =====
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
        <div class="card-seller">🏬 ${item.sellerName} · ${item.sellerArea}</div>
      </div>
    `;
    card.addEventListener("click", () => openDetail(item));
    grid.appendChild(card);
  });
}

// ===== सामान की जानकारी वाला पॉपअप (दुकानदार की जानकारी सहित) =====
function openDetail(item) {
  const modal = document.getElementById("detailModal");
  const imgSrc = item.img || "https://placehold.co/400x300/EDE4D3/1B2A4A?text=📦";
  const logoSrc = item.sellerLogo || "https://placehold.co/80x80/1B2A4A/FFFFFF?text=🏬";

  modal.innerHTML = `
    <img src="${imgSrc}" alt="${item.title}">
    <h2>${item.title}</h2>
    <div class="card-price" style="font-size:22px;">₹${item.price}</div>
    <div style="font-size:12px; color:#999; margin-top:4px;">📍 ${item.dist} दूर</div>
    ${item.stock !== undefined ? `<div style="font-size:12px; color:${item.stock === 0 ? "#C0392B" : "#2E7D4F"}; margin-top:2px;">
      ${item.stock === 0 ? "❌ स्टॉक खत्म" : `✅ ${item.stock} ${item.unit || ""} उपलब्ध`}
    </div>` : ""}

    <div class="seller-box">
      <img class="seller-avatar-img" src="${logoSrc}" alt="shop logo">
      <div class="seller-info">
        <div class="seller-name">${item.sellerName} ${item.isPremiumSeller ? '<span class="verified-badge">✔️ वेरिफाइड</span>' : ""}</div>
        <div class="seller-area">📍 ${item.sellerArea}</div>
      </div>
    </div>

    <button class="btn-primary">📞 विक्रेता से बात करें</button>
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

// ===== नया सामान जोड़ने वाला फॉर्म (होमपेज का "+" बटन — जल्दी टेस्ट के लिए) =====
function fillCategoryDropdown() {
  const select = document.getElementById("itemCat");
  select.innerHTML = "";
  categories
    .filter((c) => c.id !== "sab")
    .forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = `${c.emoji} ${c.label}`;
      select.appendChild(opt);
    });
}

function openPostForm() {
  document.getElementById("postOverlay").classList.add("show");
}
function closePostForm() {
  document.getElementById("postOverlay").classList.remove("show");
}

function handlePostSubmit(e) {
  e.preventDefault();
  const title = document.getElementById("itemTitle").value;
  const price = document.getElementById("itemPrice").value;
  const cat = document.getElementById("itemCat").value;

  demoListings.unshift({
    id: "quick-" + Date.now(),
    title: title,
    price: Number(price),
    cat: cat,
    sellerName: "आप (नया विक्रेता)",
    sellerArea: "आपका मोहल्ला",
    dist: "आपके पास",
    img: null,
    isMine: false,
  });

  buildListings();
  document.getElementById("postForm").reset();
  closePostForm();
  renderProducts();
}

function handleSearch(e) {
  searchText = e.target.value;
  renderProducts();
}

document.getElementById("searchInput").addEventListener("input", handleSearch);
document.getElementById("postBtn").addEventListener("click", openPostForm);
document.getElementById("cancelPost").addEventListener("click", closePostForm);
document.getElementById("postForm").addEventListener("submit", handlePostSubmit);
document.getElementById("detailOverlay").addEventListener("click", function (e) {
  if (e.target === this) closeDetail();
});
document.getElementById("postOverlay").addEventListener("click", function (e) {
  if (e.target === this) closePostForm();
});

// ===== पेज खुलते ही सब कुछ दिखाना =====
fillCategoryDropdown();
buildListings();
renderCategories();
renderProducts();
