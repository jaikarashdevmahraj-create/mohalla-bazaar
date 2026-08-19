const db = window.firebaseDB;
const auth = window.firebaseAuth;
const { collection, query, where, getDocs } = window.firebaseTools;
const { onAuthStateChanged, signOut } = window.authTools;

let allOrders = [];
let activeFilter = "all";

function statusLabel(status) {
  if (status === "pending") return { text: "⏳ विक्रेता के जवाब का इंतज़ार", cls: "warn-text" };
  if (status === "accepted") return { text: "✅ विक्रेता ने स्वीकार किया", cls: "" };
  if (status === "cancelled") return { text: "❌ विक्रेता ने रद्द किया", cls: "danger-text" };
  return { text: status, cls: "" };
}

async function fetchOrders(uid) {
  const q = query(collection(db, "orders"), where("buyerId", "==", uid));
  const snap = await getDocs(q);
  const orders = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  orders.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return orders;
}

function renderOrdersList() {
  const wrap = document.getElementById("ordersList");
  const filtered = activeFilter === "all" ? allOrders : allOrders.filter((o) => o.status === activeFilter);

  if (filtered.length === 0) {
    wrap.innerHTML = `<p class="empty-note">इस श्रेणी में कोई ऑर्डर नहीं है। <a href="index.html" style="color:#1B2A4A;">होमपेज पर जाकर सामान ऑर्डर करें</a>।</p>`;
    return;
  }

  wrap.innerHTML = filtered.map((o) => {
    const st = statusLabel(o.status);
    const date = o.createdAt ? new Date(o.createdAt).toLocaleDateString("hi-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";

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
          <div>🏬 विक्रेता: <b>${o.sellerName}</b></div>
          <div>🏠 डिलीवरी पता: ${o.deliveryAddress}</div>
          <div class="order-date">🕒 ${date}</div>
        </div>
      </div>
    `;
  }).join("");
}

document.getElementById("orderTabs").addEventListener("click", (e) => {
  const btn = e.target.closest(".order-tab");
  if (!btn) return;
  activeFilter = btn.dataset.filter;
  document.querySelectorAll(".order-tab").forEach((t) => t.classList.remove("active"));
  btn.classList.add("active");
  renderOrdersList();
});

document.getElementById("logoutLink").addEventListener("click", async (e) => {
  e.preventDefault();
  await signOut(auth);
  window.location.href = "index.html";
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html?next=my-orders.html";
    return;
  }
  document.getElementById("userEmailLabel").textContent = user.email;
  document.getElementById("authLoading").style.display = "none";
  document.getElementById("pageContent").style.display = "block";

  allOrders = await fetchOrders(user.uid);
  renderOrdersList();
});
