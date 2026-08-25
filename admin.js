const db = window.firebaseDB;
const auth = window.firebaseAuth;
const { collection, getDocs, doc, deleteDoc, query, orderBy, setDoc, addDoc } = window.firebaseTools;
const { onAuthStateChanged } = window.authTools;

const ADMIN_EMAILS = ["jaikarashdevmahraj@gmail.com"];

let activeTab = "sellers";
let sellersCache = [];
let productsCache = [];
let ordersCache = [];
let couponsCache = [];

async function loadAllData() {
  const [sSnap, pSnap, oSnap, cSnap] = await Promise.all([
    getDocs(collection(db, "sellers")),
    getDocs(collection(db, "products")),
    getDocs(collection(db, "orders")),
    getDocs(collection(db, "coupons")),
  ]);
  sellersCache = sSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  productsCache = pSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  ordersCache = oSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  couponsCache = cSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

function renderStats() {
  document.getElementById("adminStats").innerHTML = `
    <div class="stat-card"><div class="stat-value">${sellersCache.length}</div><div class="stat-label">कुल दुकानें</div></div>
    <div class="stat-card"><div class="stat-value">${productsCache.length}</div><div class="stat-label">कुल सामान</div></div>
    <div class="stat-card"><div class="stat-value">${ordersCache.length}</div><div class="stat-label">कुल ऑर्डर</div></div>
    <div class="stat-card"><div class="stat-value">${ordersCache.filter(o => o.status === "pending").length}</div><div class="stat-label">पेंडिंग ऑर्डर</div></div>
  `;
}

function renderContent() {
  const box = document.getElementById("adminContent");

  if (activeTab === "sellers") {
    box.innerHTML = sellersCache.map((s) => `
      <div class="section-box order-card">
        <div class="product-row-title">${s.shopName || "नाम नहीं"} ${s.isPremium ? '<span class="verified-badge">✔️ प्रीमियम</span>' : ""}</div>
        <div style="font-size:12px; color:rgba(26,26,26,0.5);">👤 ${s.ownerName || "-"} · 📞 ${s.phone || "-"}</div>
        <div style="font-size:12px; color:rgba(26,26,26,0.5);">🆔 ${s.shopId || "-"}</div>
        <button onclick="deleteSeller('${s.id}')" class="delete-account-btn" style="margin-top:8px;">🗑️ यह दुकान डिलीट करें</button>
      </div>
    `).join("") || `<p class="empty-note">कोई दुकान नहीं है।</p>`;
  }

  if (activeTab === "products") {
    box.innerHTML = productsCache.map((p) => `
      <div class="section-box order-card">
        <div class="order-card-top">
          <img src="${p.img || "https://placehold.co/60x60/EDE4D3/1B2A4A?text=📦"}" alt="${p.name}">
          <div>
            <div class="product-row-title">${p.name}</div>
            <div class="product-row-price">₹${p.price} / ${p.unit || ""}</div>
          </div>
        </div>
        <button onclick="deleteProductAdmin('${p.id}')" class="delete-account-btn" style="margin-top:8px;">🗑️ यह सामान डिलीट करें</button>
      </div>
    `).join("") || `<p class="empty-note">कोई सामान नहीं है।</p>`;
  }

  if (activeTab === "coupons") {
    box.innerHTML = `
      <div class="section-box">
        <h3>नया कूपन बनाएँ</h3>
        <form id="couponForm">
          <label>कोड (जैसे: WELCOME50)</label>
          <input type="text" id="couponCode" required style="text-transform:uppercase;">
          <label>छूट (₹ में)</label>
          <input type="number" id="couponAmount" required>
          <button type="submit" class="btn-primary" style="margin-top:10px;">कूपन बनाएँ</button>
        </form>
      </div>
    ` + couponsCache.map((c) => `
      <div class="section-box order-card">
        <div class="product-row-title">🎟️ ${c.code}</div>
        <div style="font-size:12px;">छूट: ₹${c.amount}</div>
        <button onclick="deleteCoupon('${c.id}')" class="delete-account-btn" style="margin-top:8px;">🗑️ डिलीट करें</button>
      </div>
    `).join("");

    document.getElementById("couponForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const code = document.getElementById("couponCode").value.toUpperCase();
      const amount = Number(document.getElementById("couponAmount").value);
      await addDoc(collection(db, "coupons"), { code, amount });
      await loadAllData();
      renderContent();
    });
    return;
  }

  if (activeTab === "orders") {
    const sorted = [...ordersCache].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    box.innerHTML = sorted.map((o) => `
      <div class="section-box order-card">
        <div class="product-row-title">${o.productName}</div>
        <div style="font-size:12px;">₹${o.totalAmount} · स्थिति: ${o.status}</div>
        <div style="font-size:12px; color:rgba(26,26,26,0.5);">खरीदार: ${o.buyerName} · विक्रेता: ${o.sellerName}</div>
      </div>
    `).join("") || `<p class="empty-note">कोई ऑर्डर नहीं है।</p>`;
  }
}

window.deleteCoupon = async function (id) {
  if (!confirm("क्या यह कूपन डिलीट करें?")) return;
  await deleteDoc(doc(db, "coupons", id));
  couponsCache = couponsCache.filter((c) => c.id !== id);
  renderContent();
};

window.deleteSeller = async function (id) {
  if (!confirm("क्या आप वाकई यह दुकान हमेशा के लिए डिलीट करना चाहते हैं?")) return;
  await deleteDoc(doc(db, "sellers", id));
  sellersCache = sellersCache.filter((s) => s.id !== id);
  renderStats();
  renderContent();
};

window.deleteProductAdmin = async function (id) {
  if (!confirm("क्या आप वाकई यह सामान हमेशा के लिए डिलीट करना चाहते हैं?")) return;
  await deleteDoc(doc(db, "products", id));
  productsCache = productsCache.filter((p) => p.id !== id);
  renderStats();
  renderContent();
};

document.getElementById("adminTabs").addEventListener("click", (e) => {
  const btn = e.target.closest(".order-tab");
  if (!btn) return;
  activeTab = btn.dataset.tab;
  document.querySelectorAll("#adminTabs .order-tab").forEach((t) => t.classList.remove("active"));
  btn.classList.add("active");
  renderContent();
});

onAuthStateChanged(auth, async (user) => {
  if (!user || !ADMIN_EMAILS.includes(user.email)) {
    document.getElementById("authLoading").style.display = "none";
    document.getElementById("notAdminBox").style.display = "block";
    return;
  }
  document.getElementById("authLoading").style.display = "none";
  document.getElementById("pageContent").style.display = "block";
  await loadAllData();
  renderStats();
  renderContent();
});
