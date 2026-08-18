const db = window.firebaseDB;
const { collection, doc, addDoc, updateDoc, deleteDoc, getDocs, query, where } = window.firebaseTools;
const mySellerId = window.getMySellerId();

const FREE_LIMIT = 5;
const catLabels = {
  sabzi: "🥕 सब्ज़ी-राशन",
  kapde: "👕 कपड़े",
  ghar: "🛋️ घरेलू सामान",
  electronics: "🔌 इलेक्ट्रॉनिक्स",
  handmade: "🧶 हस्तशिल्प",
};

let editingId = null;
let currentProductImg = null;
let myProductsCache = [];

function isPremium() {
  return localStorage.getItem("isPremiumSeller") === "true";
}
function setPremium(value) {
  localStorage.setItem("isPremiumSeller", value ? "true" : "false");
}

function resizeImage(file, maxSize, callback) {
  const reader = new FileReader();
  reader.onload = function (e) {
    const img = new Image();
    img.onload = function () {
      let w = img.width, h = img.height;
      if (w > h && w > maxSize) { h = Math.round((h * maxSize) / w); w = maxSize; }
      else if (h >= w && h > maxSize) { w = Math.round((w * maxSize) / h); h = maxSize; }
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      callback(canvas.toDataURL("image/jpeg", 0.65));
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function showPreview(src) {
  document.getElementById("pImgPreview").src = src;
  document.getElementById("imgPreviewWrap").style.display = "block";
}

function handleImageSelect(e) {
  const file = e.target.files[0];
  if (!file) return;
  resizeImage(file, 500, function (dataUrl) {
    currentProductImg = dataUrl;
    showPreview(dataUrl);
  });
}

// ===== Firebase से मेरा सामान लाना =====
async function fetchMyProducts() {
  const q = query(collection(db, "products"), where("sellerId", "==", mySellerId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

function renderPremiumCard() {
  const premium = isPremium();
  const card = document.getElementById("premiumCard");
  if (premium) {
    card.innerHTML = `
      <div class="premium-card premium-active">
        <div class="premium-badge">⭐ प्रीमियम विक्रेता</div>
        <p>आपको मिल रहा है: अनलिमिटेड लिस्टिंग, फीचर्ड प्रोडक्ट, वेरिफाइड बैज, एडवांस्ड एनालिसिस</p>
        <button class="btn-secondary" id="downgradeBtn">प्रीमियम रद्द करें (डेमो)</button>
      </div>`;
    document.getElementById("downgradeBtn").addEventListener("click", () => { setPremium(false); renderAll(); });
  } else {
    card.innerHTML = `
      <div class="premium-card">
        <div class="premium-title">🔓 प्रीमियम विक्रेता बनें</div>
        <ul class="premium-list">
          <li>✅ अनलिमिटेड लिस्टिंग (अभी सिर्फ़ ${FREE_LIMIT} तक)</li>
          <li>✅ सामान को सर्च में ऊपर दिखाएँ (फीचर्ड)</li>
          <li>✅ प्रोफाइल पर ✔️ वेरिफाइड बैज</li>
          <li>✅ एडवांस्ड बिक्री एनालिसिस</li>
        </ul>
        <button class="btn-primary" id="upgradeBtn">प्रीमियम में अपग्रेड करें (डेमो)</button>
        <p class="premium-hint">यह अभी सिर्फ़ डेमो बटन है, असली पेमेंट बाद में जोड़ेंगे</p>
      </div>`;
    document.getElementById("upgradeBtn").addEventListener("click", () => { setPremium(true); renderAll(); });
  }
}

function renderTitle() {
  document.getElementById("pageTitle").innerHTML = isPremium()
    ? `विक्रेता डैशबोर्ड <span class="verified-badge">✔️ वेरिफाइड</span>`
    : `विक्रेता डैशबोर्ड`;
}

function renderStats(products) {
  const totalItems = products.length;
  const totalStockValue = products.reduce((s, p) => s + p.price * p.stock, 0);
  const lowStock = products.filter((p) => p.stock > 0 && p.stock < 5).length;
  const outOfStock = products.filter((p) => p.stock === 0).length;
  document.getElementById("statGrid").innerHTML = `
    <div class="stat-card"><div class="stat-value">${totalItems}${isPremium() ? "" : " / " + FREE_LIMIT}</div><div class="stat-label">कुल लिस्टिंग</div></div>
    <div class="stat-card"><div class="stat-value">₹${totalStockValue.toLocaleString("en-IN")}</div><div class="stat-label">कुल स्टॉक की कीमत</div></div>
    <div class="stat-card ${lowStock > 0 ? "warn" : ""}"><div class="stat-value">${lowStock}</div><div class="stat-label">कम स्टॉक (5 से कम)</div></div>
    <div class="stat-card ${outOfStock > 0 ? "danger" : ""}"><div class="stat-value">${outOfStock}</div><div class="stat-label">स्टॉक खत्म</div></div>`;
}

function renderAdvanced(products) {
  const box = document.getElementById("advancedSection");
  if (!isPremium()) {
    box.innerHTML = `<h3>📊 एडवांस्ड एनालिसिस</h3><div class="locked-box"><p>🔒 यह सुविधा सिर्फ़ प्रीमियम विक्रेताओं के लिए है।</p><p class="premium-hint">ऊपर "प्रीमियम में अपग्रेड करें" दबाकर अनलॉक करें</p></div>`;
    return;
  }
  if (products.length === 0) {
    box.innerHTML = `<h3>📊 एडवांस्ड एनालिसिस</h3><p class="empty-note">पहले कुछ सामान जोड़ें, तब आंकड़े दिखेंगे।</p>`;
    return;
  }
  const avgPrice = Math.round(products.reduce((s, p) => s + p.price, 0) / products.length);
  const highest = products.reduce((a, b) => (a.price > b.price ? a : b));
  const cheapest = products.reduce((a, b) => (a.price < b.price ? a : b));
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const addedThisWeek = products.filter((p) => (p.createdAt || 0) > weekAgo).length;
  const featuredCount = products.filter((p) => p.featured).length;
  box.innerHTML = `
    <h3>📊 एडवांस्ड एनालिसिस</h3>
    <div class="analysis-row"><span>औसत कीमत</span><b>₹${avgPrice}</b></div>
    <div class="analysis-row"><span>सबसे महँगा सामान</span><b>${highest.name} (₹${highest.price})</b></div>
    <div class="analysis-row"><span>सबसे सस्ता सामान</span><b>${cheapest.name} (₹${cheapest.price})</b></div>
    <div class="analysis-row"><span>इस हफ़्ते जोड़ा गया</span><b>${addedThisWeek} सामान</b></div>
    <div class="analysis-row"><span>फीचर्ड सामान</span><b>${featuredCount}</b></div>
    <p class="premium-hint">बिक्री का रुझान असली ऑर्डर आने पर दिखेगा</p>`;
}

function renderCatBars(products) {
  const wrap = document.getElementById("catBars");
  if (products.length === 0) { wrap.innerHTML = `<p class="empty-note">अभी कोई सामान नहीं जोड़ा गया।</p>`; return; }
  const counts = {};
  products.forEach((p) => { counts[p.cat] = (counts[p.cat] || 0) + 1; });
  const max = Math.max(...Object.values(counts));
  wrap.innerHTML = Object.keys(counts).map((cat) => {
    const pct = Math.round((counts[cat] / max) * 100);
    return `<div class="cat-bar-row"><span class="cat-bar-label">${catLabels[cat] || cat}</span><div class="cat-bar-track"><div class="cat-bar-fill" style="width:${pct}%"></div></div><span class="cat-bar-count">${counts[cat]}</span></div>`;
  }).join("");
}

function renderMyProducts(products) {
  document.getElementById("countLabel").textContent = products.length;
  const sorted = [...products].sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
  const wrap = document.getElementById("myProducts");
  if (sorted.length === 0) {
    wrap.innerHTML = `<p class="empty-note">आपने अभी तक कोई सामान लिस्ट नहीं किया। नीचे फॉर्म से जोड़ें 👆</p>`;
    return;
  }
  wrap.innerHTML = sorted.map((p) => {
    let stockClass = "", stockText = `${p.stock} ${p.unit} उपलब्ध`;
    if (p.stock === 0) { stockClass = "danger-text"; stockText = "स्टॉक खत्म ❌"; }
    else if (p.stock < 5) { stockClass = "warn-text"; stockText = `सिर्फ़ ${p.stock} ${p.unit} बचा`; }
    return `
      <div class="product-row ${p.featured ? "featured-row" : ""}">
        <img src="${p.img || "https://placehold.co/80x80/EDE4D3/1B2A4A?text=📦"}" alt="${p.name}">
        <div class="product-row-info">
          <div class="product-row-title">${p.name} ${p.featured ? '<span class="featured-tag">⭐ फीचर्ड</span>' : ""}</div>
          <div class="product-row-price">₹${p.price} / ${p.unit}</div>
          <div class="${stockClass}">${stockText}</div>
        </div>
        <div class="product-row-actions">
          <button onclick="toggleFeatured('${p.id}')" class="mini-btn ${p.featured ? "star-active" : ""}">⭐</button>
          <button onclick="startEdit('${p.id}')" class="mini-btn edit">✏️</button>
          <button onclick="deleteProduct('${p.id}')" class="mini-btn delete">🗑️</button>
        </div>
      </div>`;
  }).join("");
}

window.toggleFeatured = async function (id) {
  if (!isPremium()) { alert("यह सुविधा सिर्फ़ प्रीमियम विक्रेताओं के लिए है।"); return; }
  const p = myProductsCache.find((x) => x.id === id);
  if (!p) return;
  await updateDoc(doc(db, "products", id), { featured: !p.featured });
  renderAll();
};

window.startEdit = function (id) {
  const p = myProductsCache.find((x) => x.id === id);
  if (!p) return;
  editingId = id;
  currentProductImg = p.img || null;
  document.getElementById("pName").value = p.name;
  document.getElementById("pPrice").value = p.price;
  document.getElementById("pUnit").value = p.unit;
  document.getElementById("pStock").value = p.stock;
  document.getElementById("pCat").value = p.cat;
  if (p.img) showPreview(p.img);
  else document.getElementById("imgPreviewWrap").style.display = "none";
  document.getElementById("formTitle").textContent = "सामान एडिट करें";
  document.getElementById("submitBtn").textContent = "बदलाव सेव करें";
  document.getElementById("cancelEdit").style.display = "block";
  window.scrollTo({ top: document.getElementById("sellerForm").offsetTop - 20, behavior: "smooth" });
};

window.deleteProduct = async function (id) {
  if (!confirm("क्या आप वाकई इस सामान को हटाना चाहते हैं?")) return;
  await deleteDoc(doc(db, "products", id));
  renderAll();
};

function resetForm() {
  editingId = null;
  currentProductImg = null;
  document.getElementById("sellerForm").reset();
  document.getElementById("pImgFile").value = "";
  document.getElementById("imgPreviewWrap").style.display = "none";
  document.getElementById("formTitle").textContent = "नया सामान जोड़ें";
  document.getElementById("submitBtn").textContent = "सामान जोड़ें";
  document.getElementById("cancelEdit").style.display = "none";
}

async function handleSubmit(e) {
  e.preventDefault();
  const submitBtn = document.getElementById("submitBtn");

  if (!editingId && !isPremium() && myProductsCache.length >= FREE_LIMIT) {
    alert(`फ्री प्लान में सिर्फ़ ${FREE_LIMIT} सामान तक लिस्ट कर सकते हैं। अनलिमिटेड लिस्टिंग के लिए प्रीमियम अपग्रेड करें।`);
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "सेव हो रहा है...";

  const data = {
    name: document.getElementById("pName").value,
    price: Number(document.getElementById("pPrice").value),
    unit: document.getElementById("pUnit").value,
    stock: Number(document.getElementById("pStock").value),
    cat: document.getElementById("pCat").value,
    img: currentProductImg,
  };

  try {
    if (editingId) {
      await updateDoc(doc(db, "products", editingId), data);
    } else {
      await addDoc(collection(db, "products"), {
        ...data,
        sellerId: mySellerId,
        featured: false,
        createdAt: Date.now(),
      });
    }
    resetForm();
    await renderAll();
  } catch (err) {
    console.error(err);
    alert("सेव करने में दिक्कत आई। इंटरनेट चेक करके दोबारा कोशिश करें।");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = editingId ? "बदलाव सेव करें" : "सामान जोड़ें";
  }
}

function renderLimitNote() {
  const note = document.getElementById("limitNote");
  const count = myProductsCache.length;
  if (isPremium()) {
    note.textContent = "✅ प्रीमियम: अनलिमिटेड लिस्टिंग";
    note.className = "limit-note ok";
  } else {
    note.textContent = `फ्री प्लान: ${count} / ${FREE_LIMIT} इस्तेमाल हुआ`;
    note.className = "limit-note";
  }
}

async function renderAll() {
  myProductsCache = await fetchMyProducts();
  renderPremiumCard();
  renderTitle();
  renderStats(myProductsCache);
  renderAdvanced(myProductsCache);
  renderCatBars(myProductsCache);
  renderMyProducts(myProductsCache);
  renderLimitNote();
}

document.getElementById("sellerForm").addEventListener("submit", handleSubmit);
document.getElementById("cancelEdit").addEventListener("click", resetForm);
document.getElementById("pImgFile").addEventListener("change", handleImageSelect);
document.getElementById("removeImgBtn").addEventListener("click", () => {
  currentProductImg = null;
  document.getElementById("pImgFile").value = "";
  document.getElementById("imgPreviewWrap").style.display = "none";
});

renderAll();
