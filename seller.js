// ===== डेटा localStorage से पढ़ना (या खाली लिस्ट से शुरू करना) =====
function getProducts() {
  const data = localStorage.getItem("mySellerProducts");
  return data ? JSON.parse(data) : [];
}

function saveProducts(list) {
  localStorage.setItem("mySellerProducts", JSON.stringify(list));
}

const catLabels = {
  sabzi: "🥕 सब्ज़ी-राशन",
  kapde: "👕 कपड़े",
  ghar: "🛋️ घरेलू सामान",
  electronics: "🔌 इलेक्ट्रॉनिक्स",
  handmade: "🧶 हस्तशिल्प",
};

let editingId = null;

// ===== आंकड़े (stats) दिखाना =====
function renderStats() {
  const products = getProducts();
  const totalItems = products.length;
  const totalStockValue = products.reduce((sum, p) => sum + p.price * p.stock, 0);
  const lowStock = products.filter((p) => p.stock > 0 && p.stock < 5).length;
  const outOfStock = products.filter((p) => p.stock === 0).length;

  const grid = document.getElementById("statGrid");
  grid.innerHTML = `
    <div class="stat-card">
      <div class="stat-value">${totalItems}</div>
      <div class="stat-label">कुल लिस्टिंग</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">₹${totalStockValue.toLocaleString("en-IN")}</div>
      <div class="stat-label">कुल स्टॉक की कीमत</div>
    </div>
    <div class="stat-card ${lowStock > 0 ? "warn" : ""}">
      <div class="stat-value">${lowStock}</div>
      <div class="stat-label">कम स्टॉक (5 से कम)</div>
    </div>
    <div class="stat-card ${outOfStock > 0 ? "danger" : ""}">
      <div class="stat-value">${outOfStock}</div>
      <div class="stat-label">स्टॉक खत्म</div>
    </div>
  `;
}

// ===== श्रेणी के हिसाब से बार-चार्ट =====
function renderCatBars() {
  const products = getProducts();
  const wrap = document.getElementById("catBars");

  if (products.length === 0) {
    wrap.innerHTML = `<p class="empty-note">अभी कोई सामान नहीं जोड़ा गया।</p>`;
    return;
  }

  const counts = {};
  products.forEach((p) => {
    counts[p.cat] = (counts[p.cat] || 0) + 1;
  });
  const max = Math.max(...Object.values(counts));

  wrap.innerHTML = Object.keys(counts)
    .map((cat) => {
      const pct = Math.round((counts[cat] / max) * 100);
      return `
        <div class="cat-bar-row">
          <span class="cat-bar-label">${catLabels[cat] || cat}</span>
          <div class="cat-bar-track">
            <div class="cat-bar-fill" style="width:${pct}%"></div>
          </div>
          <span class="cat-bar-count">${counts[cat]}</span>
        </div>
      `;
    })
    .join("");
}

// ===== मेरे सामान की लिस्ट दिखाना =====
function renderMyProducts() {
  const products = getProducts();
  const wrap = document.getElementById("myProducts");
  document.getElementById("countLabel").textContent = products.length;

  if (products.length === 0) {
    wrap.innerHTML = `<p class="empty-note">आपने अभी तक कोई सामान लिस्ट नहीं किया। नीचे फॉर्म से जोड़ें 👆</p>`;
    return;
  }

  wrap.innerHTML = products
    .map((p) => {
      let stockClass = "";
      let stockText = `${p.stock} ${p.unit} उपलब्ध`;
      if (p.stock === 0) {
        stockClass = "danger-text";
        stockText = "स्टॉक खत्म ❌";
      } else if (p.stock < 5) {
        stockClass = "warn-text";
        stockText = `सिर्फ़ ${p.stock} ${p.unit} बचा — जल्दी बढ़ाएँ`;
      }

      return `
        <div class="product-row">
          <img src="${p.img || "https://placehold.co/80x80/EDE4D3/1B2A4A?text=📦"}" alt="${p.name}">
          <div class="product-row-info">
            <div class="product-row-title">${p.name}</div>
            <div class="product-row-price">₹${p.price} / ${p.unit}</div>
            <div class="${stockClass}">${stockText}</div>
          </div>
          <div class="product-row-actions">
            <button onclick="startEdit(${p.id})" class="mini-btn edit">✏️</button>
            <button onclick="deleteProduct(${p.id})" class="mini-btn delete">🗑️</button>
          </div>
        </div>
      `;
    })
    .join("");
}

// ===== नया सामान जोड़ना / एडिट सेव करना =====
function handleSubmit(e) {
  e.preventDefault();
  const name = document.getElementById("pName").value;
  const price = Number(document.getElementById("pPrice").value);
  const unit = document.getElementById("pUnit").value;
  const stock = Number(document.getElementById("pStock").value);
  const cat = document.getElementById("pCat").value;
  const img = document.getElementById("pImg").value;

  let products = getProducts();

  if (editingId) {
    // पुराना सामान अपडेट करना
    products = products.map((p) =>
      p.id === editingId ? { ...p, name, price, unit, stock, cat, img } : p
    );
  } else {
    // नया सामान जोड़ना
    products.unshift({ id: Date.now(), name, price, unit, stock, cat, img });
  }

  saveProducts(products);
  resetForm();
  renderAll();
}

// ===== एडिट शुरू करना =====
function startEdit(id) {
  const products = getProducts();
  const p = products.find((x) => x.id === id);
  if (!p) return;

  editingId = id;
  document.getElementById("pName").value = p.name;
  document.getElementById("pPrice").value = p.price;
  document.getElementById("pUnit").value = p.unit;
  document.getElementById("pStock").value = p.stock;
  document.getElementById("pCat").value = p.cat;
  document.getElementById("pImg").value = p.img || "";

  document.getElementById("formTitle").textContent = "सामान एडिट करें";
  document.getElementById("submitBtn").textContent = "बदलाव सेव करें";
  document.getElementById("cancelEdit").style.display = "block";
  window.scrollTo({ top: document.getElementById("sellerForm").offsetTop - 20, behavior: "smooth" });
}

// ===== एडिट रद्द करना =====
function resetForm() {
  editingId = null;
  document.getElementById("sellerForm").reset();
  document.getElementById("formTitle").textContent = "नया सामान जोड़ें";
  document.getElementById("submitBtn").textContent = "सामान जोड़ें";
  document.getElementById("cancelEdit").style.display = "none";
}

// ===== सामान हटाना =====
function deleteProduct(id) {
  if (!confirm("क्या आप वाकई इस सामान को हटाना चाहते हैं?")) return;
  let products = getProducts();
  products = products.filter((p) => p.id !== id);
  saveProducts(products);
  renderAll();
}

// ===== सब कुछ एक साथ रिफ्रेश करना =====
function renderAll() {
  renderStats();
  renderCatBars();
  renderMyProducts();
}

document.getElementById("sellerForm").addEventListener("submit", handleSubmit);
document.getElementById("cancelEdit").addEventListener("click", resetForm);

renderAll();
