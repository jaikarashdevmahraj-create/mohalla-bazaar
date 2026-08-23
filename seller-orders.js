const db = window.firebaseDB;
const auth = window.firebaseAuth;
const { collection, query, where, getDocs, doc, updateDoc, orderBy, onSnapshot } = window.firebaseTools;
const { onAuthStateChanged } = window.authTools;

let myUid = null;
let allOrders = [];
let activeFilter = "pending";

function statusLabel(status) {
  if (status === "pending") return { text: "⏳ पेंडिंग", cls: "warn-text" };
  if (status === "accepted") return { text: "✅ स्वीकार किया गया", cls: "" };
  if (status === "cancelled") return { text: "❌ रद्द किया गया", cls: "danger-text" };
  return { text: status, cls: "" };
}

async function fetchOrders() {
  const q = query(collection(db, "orders"), where("sellerId", "==", myUid));
  const snap = await getDocs(q);
  const orders = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  orders.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return orders;
}

function renderStats() {
  const pending = allOrders.filter((o) => o.status === "pending").length;
  const accepted = allOrders.filter((o) => o.status === "accepted").length;
  const cancelled = allOrders.filter((o) => o.status === "cancelled").length;

  document.getElementById("orderStats").innerHTML = `
    <div class="stat-card ${pending > 0 ? "warn" : ""}">
      <div class="stat-value">${pending}</div>
      <div class="stat-label">पेंडिंग ऑर्डर</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${accepted}</div>
      <div class="stat-label">स्वीकार किए गए</div>
    </div>
    <div class="stat-card danger">
      <div class="stat-value">${cancelled}</div>
      <div class="stat-label">रद्द किए गए</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${allOrders.length}</div>
      <div class="stat-label">कुल ऑर्डर</div>
    </div>
  `;
}

function renderOrdersList() {
  const wrap = document.getElementById("ordersList");
  const filtered = activeFilter === "all" ? allOrders : allOrders.filter((o) => o.status === activeFilter);

  if (filtered.length === 0) {
    wrap.innerHTML = `<p class="empty-note">इस श्रेणी में कोई ऑर्डर नहीं है।</p>`;
    return;
  }

  wrap.innerHTML = filtered.map((o) => {
    const st = statusLabel(o.status);
    const date = o.createdAt ? new Date(o.createdAt).toLocaleDateString("hi-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
    const actionsHtml = o.status === "pending" ? `
      <div class="order-actions">
        <button onclick="acceptOrder('${o.id}')" class="btn-primary" style="margin-top:10px;">✅ स्वीकार करें</button>
        <button onclick="cancelOrder('${o.id}')" class="delete-account-btn" style="margin-top:8px;">❌ रद्द करें</button>
      </div>
    ` : "";

    return `
      <div class="section-box order-card">
        <div class="order-card-top">
          <img src="${o.productImg || "https://placehold.co/70x70/EDE4D3/1B2A4A?text=📦"}" alt="${o.productName}">
          <div>
            <div class="product-row-title">${o.productName}</div>
            <div class="product-row-price">₹${o.price} x ${o.quantity} = ₹${o.totalAmount}</div>
            <div class="${st.cls}" style="font-size:12px; font-weight:600;">${st.text}</div>
          </div>
        </div>
        <div class="order-buyer-info">
          <div>👤 <b>${o.buyerName}</b> · 📞 ${o.buyerPhone}</div>
          <div>🏠 ${o.deliveryAddress}</div>
          ${o.note ? `<div>📝 ${o.note}</div>` : ""}
          <div class="order-date">🕒 ${date}</div>
        </div>
        <a href="invoice.html?id=${o.id}" class="shop-link-btn" style="margin-top:8px;">🧾 इनवॉइस देखें</a>
        ${actionsHtml}
      </div>
    `;
  }).join("");
}

window.acceptOrder = async function (id) {
  await updateDoc(doc(db, "orders", id), { status: "accepted" });
  await refresh();
};

let cancelTargetId = null;

window.cancelOrder = function (id) {
  cancelTargetId = id;
  document.getElementById("cancelReasonOverlay").classList.add("show");
};

function closeCancelReasonForm() {
  document.getElementById("cancelReasonOverlay").classList.remove("show");
  cancelTargetId = null;
}

async function handleCancelReasonSubmit(e) {
  e.preventDefault();
  if (!cancelTargetId) return;

  const reason = document.getElementById("cancelReasonSelect").value;
  const note = document.getElementById("cancelReasonNote").value;

  await updateDoc(doc(db, "orders", cancelTargetId), {
    status: "cancelled",
    cancelReason: reason,
    cancelNote: note,
  });

  closeCancelReasonForm();
  document.getElementById("cancelReasonForm").reset();
  await refresh();
}

async function refresh() {
  allOrders = await fetchOrders();
  renderStats();
  renderOrdersList();
}
document.getElementById("cancelReasonCancel").addEventListener("click", closeCancelReasonForm);
document.getElementById("cancelReasonOverlay").addEventListener("click", (e) => { if (e.target === e.currentTarget) closeCancelReasonForm(); });
document.getElementById("cancelReasonForm").addEventListener("submit", handleCancelReasonSubmit);

document.getElementById("orderTabs").addEventListener("click", (e) => {
document.getElementById("orderTabs").addEventListener("click", (e) => {
  const btn = e.target.closest(".order-tab");
  if (!btn) return;
  activeFilter = btn.dataset.filter;
  document.querySelectorAll(".order-tab").forEach((t) => t.classList.remove("active"));
  btn.classList.add("active");
  renderOrdersList();
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html?next=seller-orders.html";
    return;
  }
  myUid = user.uid;
  document.getElementById("authLoading").style.display = "none";
  document.getElementById("pageContent").style.display = "block";
  await refresh();

  // ===== पेज खुला हो तो नया ऑर्डर आते ही अपने आप दिख जाए =====
  const q = query(collection(db, "orders"), where("sellerId", "==", myUid));
  onSnapshot(q, () => {
    refresh();
  });
});
