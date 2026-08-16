// ===== 1. सामान की लिस्ट (डेटा) =====
// असली ऐप में यह डेटा सर्वर से आएगा, अभी के लिए यहीं लिखा है
const categories = [
  { id: "sab", label: "सब कुछ", emoji: "🏪" },
  { id: "sabzi", label: "सब्ज़ी-राशन", emoji: "🥕" },
  { id: "kapde", label: "कपड़े", emoji: "👕" },
  { id: "ghar", label: "घरेलू सामान", emoji: "🛋️" },
  { id: "electronics", label: "इलेक्ट्रॉनिक्स", emoji: "🔌" },
  { id: "handmade", label: "हस्तशिल्प", emoji: "🧶" },
];

let listings = [
  { id: 1, title: "ताज़ा देसी टमाटर (1 किलो)", price: 40, cat: "sabzi", sellerName: "सुनीता जी", sellerArea: "शास्त्री नगर", dist: "350 मीटर", img: "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=400&q=60" },
  { id: 2, title: "हाथ से बुना ऊनी शॉल", price: 850, cat: "handmade", sellerName: "अजय हैंडीक्राफ्ट", sellerArea: "मॉडल टाउन", dist: "2.1 किमी", img: "https://images.unsplash.com/photo-1520903920243-00d872a2d1c9?w=400&q=60" },
  { id: 3, title: "कॉटन कुर्ती (M साइज़)", price: 320, cat: "kapde", sellerName: "प्रिया स्टोर्स", sellerArea: "नेहरू कॉलोनी", dist: "900 मीटर", img: "https://images.unsplash.com/photo-1583391733956-6c78276477e2?w=400&q=60" },
  { id: 4, title: "स्टील डिनर सेट (24 पीस)", price: 1200, cat: "ghar", sellerName: "रमेश भाई", sellerArea: "गाँधी चौक", dist: "1.4 किमी", img: "https://images.unsplash.com/photo-1584346133934-a3a9c893a5d7?w=400&q=60" },
  { id: 5, title: "टेबल फैन (नया)", price: 999, cat: "electronics", sellerName: "विकास इलेक्ट्रिकल्स", sellerArea: "स्टेशन रोड", dist: "1.8 किमी", img: "https://images.unsplash.com/photo-1617103996702-96ff29b1c467?w=400&q=60" },
  { id: 6, title: "अचार का सेट (मिक्स)", price: 180, cat: "sabzi", sellerName: "कमला दीदी", sellerArea: "शास्त्री नगर", dist: "500 मीटर", img: "https://images.unsplash.com/photo-1626200926749-24197f80f095?w=400&q=60" },
];

let activeCategory = "sab";
let searchText = "";

// ===== 2. श्रेणियाँ (categories) दिखाना =====
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

// ===== 3. प्रोडक्ट कार्ड्स दिखाना =====
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
    card.innerHTML = `
      <img src="${item.img}" alt="${item.title}">
      <span class="dist-badge">📍 ${item.dist}</span>
      <div class="card-body">
        <div class="card-title">${item.title}</div>
        <div class="card-price">₹${item.price}</div>
        <div class="card-seller">${item.sellerName} · ${item.sellerArea}</div>
      </div>
    `;
    card.addEventListener("click", () => openDetail(item));
    grid.appendChild(card);
  });
}

// ===== 4. सामान की जानकारी वाला पॉपअप खोलना =====
function openDetail(item) {
  const modal = document.getElementById("detailModal");
  modal.innerHTML = `
    <img src="${item.img}" alt="${item.title}">
    <h2>${item.title}</h2>
    <div class="card-price" style="font-size:22px;">₹${item.price}</div>
    <div style="font-size:12px; color:#999; margin-top:4px;">📍 ${item.dist} दूर</div>
    <div class="seller-box">
      <div class="seller-avatar">${item.sellerName.charAt(0)}</div>
      <div class="seller-info">
        <div class="seller-name">${item.sellerName}</div>
        <div class="seller-area">${item.sellerArea}</div>
      </div>
    </div>
    <button class="btn-primary">📞 विक्रेता से बात करें</button>
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

// ===== 5. नया सामान जोड़ने वाला फॉर्म =====
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

  const newItem = {
    id: Date.now(),
    title: title,
    price: Number(price),
    cat: cat,
    sellerName: "आप (नया विक्रेता)",
    sellerArea: "आपका मोहल्ला",
    dist: "आपके पास",
    img: "https://placehold.co/400x300/EDE4D3/1B2A4A?text=नया+सामान",
  };

  listings.unshift(newItem); // नई चीज़ लिस्ट में सबसे ऊपर जोड़ना
  document.getElementById("postForm").reset();
  closePostForm();
  renderProducts();
}

// ===== 6. सर्च बॉक्स =====
function handleSearch(e) {
  searchText = e.target.value;
  renderProducts();
}

// ===== 7. शुरुआत में सब कुछ जोड़ना (event listeners) =====
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

// ===== 8. पेज खुलते ही सब कुछ दिखाना =====
fillCategoryDropdown();
renderCategories();
renderProducts();
