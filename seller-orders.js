const db = window.firebaseDB;
const auth = window.firebaseAuth;
const { collection, query, where, doc, updateDoc, onSnapshot } = window.firebaseTools;
const { onAuthStateChanged } = window.authTools;

let myUid = null;
let allOrders = [];
let activeFilter = "pending";
let cancelTargetId = null;

function statusLabel(status) {
  if (status === "pending") return { text: "⏳ पेंडिंग", cls: "warn-text" };
  if (status === "accepted") return { text: "✅ स्वीकार किया गया", cls: "" };
  if (status === "packed") return { text: "📦 पैक हो गया", cls: "" };
  if (status === "out_for_delivery") return { text: "🚚 डिलीवरी के लिए निकला", cls: "" };
  if (status === "delivered") return { text: "🏠 डिलीवर हो गया", cls: "" };
  if (status === "cancelled") return { text: "❌ रद्द किया गया", cls: "danger-text" };
  return { text: status, cls: "" };
}

function renderStats() {
  const pending = allOrders.filter((o) => o.status === "pending").length;
  const accepted = allOrders.filter((o) => o.status === "accepted" || o.status === "packed" || o.status === "out_for_delivery").length;
  const delivered = allOrders.filter((o) => o.status === "delivered").length;
  const cancelled = allOrders.filter((o) => o.status === "cancelled").length;

  document.getElementById("orderStats").innerHTML = `
    <div class="stat-card ${pending > 0 ? "warn" : ""}">
      <div class="stat-value">${pending}</div>
      <div class="stat-label">${window.i18n.t("pendingOrdersStat")}</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${accepted}</div>
      <div class="stat-label">${window.i18n.t("acceptedOrdersStat")}</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${delivered}</div>
      <div class="stat-label">${window.i18n.t("deliveredOrdersStat")}</div>
    </div>
    <div class="stat-card danger">
      <div class="stat-value">${cancelled}</div>
      <div class="stat-label">${window.i18n.t("cancelledOrdersStat")}</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${allOrders.length}</div>
      <div class="stat-label">${window.i18n.t("totalOrdersStat")}</div>
    </div>
  `;
}

function renderOrdersList() {
  const wrap = document.getElementById("ordersList");
  const filtered = activeFilter === "all" ? allOrders : allOrders.filter((o) => o.status === activeFilter);

  if (filtered.length === 0) {
    wrap.innerHTML = `<p class="empty-note">${window.i18n.t("noOrdersInCategory")}</p>`;
    return;
  }

  wrap.innerHTML = filtered.map((o) => {
    const st = statusLabel(o.status);
    const date = o.createdAt ? new Date(o.createdAt).toLocaleDateString("hi-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";

    const paymentHtml = o.paymentStatus === "buyer_marked_paid"
      ? `<div class="payment-badge">💰 ग्राहक ने बताया है कि UPI से भुगतान कर दिया है</div>
         <button onclick="confirmPaymentReceived('${o.id}')" class="edit-toggle-btn" style="margin-top:6px;">${window.i18n.t("confirmPayment")}</button>`
      : (o.paymentStatus === "confirmed" ? `<div class="payment-badge paid">✅ भुगतान मिल चुका है</div>` : "");

    const actionsHtml = o.status === "pending" ? `
      <div class="order-actions">
        <button onclick="acceptOrder('${o.id}')" class="btn-primary" style="margin-top:10px;">${window.i18n.t("acceptBtn")}</button>
        <button onclick="cancelOrder('${o.id}')" class="delete-account-btn" style="margin-top:8px;">${window.i18n.t("rejectBtn")}</button>
      </div>
    ` : o.status === "accepted" ? `
      <button onclick="markPacked('${o.id}')" class="btn-primary" style="margin-top:10px;">${window.i18n.t("markPackedBtn")}</button>
    ` : o.status === "packed" ? `
      <button onclick="markOutForDelivery('${o.id}')" class="btn-primary" style="margin-top:10px;">${window.i18n.t("markOutForDeliveryBtn")}</button>
    ` : o.status === "out_for_delivery" ? `
      <button onclick="markDelivered('${o.id}')" class="btn-primary" style="margin-top:10px;">${window.i18n.t("markDeliveredBtn")}</button>
    ` : "";

    return `
      <div class="section-box order-card">
        <div class="order-card-top">
          <img src="${o.productImg || "https://placehold.co/70x70/EDE4D3/1B2A4A?text=📦"}" alt="${o.productName}">
          <div>
            <div class="product-row-title">${o.productName}</div>
            <div class="product-row-price">₹${o.price} x ${o.quantity} = ₹${o.totalAmount}</div>
            ${o.discountAmount ? `<div style="font-size:11px; color:#2E7D4F;">🎟️ खरीदार को कूपन छूट: -₹${o.discountAmount}</div>` : ""}
            <div class="${st.cls}" style="font-size:12px; font-weight:600;">${st.text}</div>
          </div>
        </div>
        <div class="order-buyer-info">
          <div>👤 <b>${o.buyerName}</b> · 📞 ${o.buyerPhone}</div>
          <div>🏠 ${o.deliveryAddress}</div>
          ${o.note ? `<div>📝 ${o.note}</div>` : ""}
          <div class="order-date">🕒 ${date}</div>
        </div>
        <a href="invoice.html?id=${o.id}" class="shop-link-btn" style="margin-top:8px;">${window.i18n.t("viewInvoice")}</a>
        ${paymentHtml}
        ${actionsHtml}
      </div>
    `;
  }).join("");
}

window.acceptOrder = async function (id) {
  await updateDoc(doc(db, "orders", id), { status: "accepted" });
};

window.markPacked = async function (id) {
  await updateDoc(doc(db, "orders", id), { status: "packed" });
};

window.markOutForDelivery = async function (id) {
  await updateDoc(doc(db, "orders", id), { status: "out_for_delivery" });
};

window.markDelivered = async function (id) {
  await updateDoc(doc(db, "orders", id), { status: "delivered" });
};

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
}

window.confirmPaymentReceived = async function (id) {
  await updateDoc(doc(db, "orders", id), { paymentStatus: "confirmed" });
};

document.getElementById("cancelReasonCancel").addEventListener("click", closeCancelReasonForm);
document.getElementById("cancelReasonOverlay").addEventListener("click", (e) => { if (e.target === e.currentTarget) closeCancelReasonForm(); });
document.getElementById("cancelReasonForm").addEventListener("submit", handleCancelReasonSubmit);

document.getElementById("orderTabs").addEventListener("click", (e) => {
  const btn = e.target.closest(".order-tab");
  if (!btn) return;
  activeFilter = btn.dataset.filter;
  document.querySelectorAll(".order-tab").forEach((t) => t.classList.remove("active"));
  btn.classList.add("active");
  renderOrdersList();
});

document.getElementById("langToggleBtn").addEventListener("click", () => {
  const newLang = window.i18n.getLang() === "hi" ? "en" : "hi";
  window.i18n.setLang(newLang);
  window.i18n.applyTranslations();
  renderStats();
  renderOrdersList();
});

onAuthStateChanged(auth, async (user) => {
  window.i18n.applyTranslations();
  if (!user) {
    window.location.href = "login.html?next=seller-orders.html";
    return;
  }
  myUid = user.uid;
  document.getElementById("authLoading").style.display = "none";
  document.getElementById("pageContent").style.display = "block";

  const q = query(collection(db, "orders"), where("sellerId", "==", myUid));
  onSnapshot(q, (snap) => {
    allOrders = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    allOrders.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    renderStats();
    renderOrdersList();
  });
});
