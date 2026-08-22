const db = window.firebaseDB;
const auth = window.firebaseAuth;
const { collection, query, where, getDocs, doc, setDoc, getDoc, addDoc, onSnapshot } = window.firebaseTools;
const { onAuthStateChanged, signOut } = window.authTools;

let allOrders = [];
let activeFilter = "all";
let myUid = null;
let myName = "";
let reviewedOrderIds = new Set();
let reviewTargetOrder = null;
let selectedRating = 0;

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

async function fetchMyReviews(uid) {
  const q = query(collection(db, "reviews"), where("buyerId", "==", uid));
  const snap = await getDocs(q);
  return new Set(snap.docs.map((d) => d.data().orderId));
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
    const alreadyReviewed = reviewedOrderIds.has(o.id);
    const reviewBtnHtml = o.status === "accepted"
      ? (alreadyReviewed
          ? `<p class="premium-hint" style="margin-top:8px;">✅ आपने इसे रेट कर दिया है</p>`
          : `<button onclick="openReview('${o.id}')" class="edit-toggle-btn" style="margin-top:8px;">⭐ रेटिंग दें</button>`)
      : "";

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
        ${reviewBtnHtml}
      </div>
    `;
  }).join("");
}

window.openReview = function (orderId) {
  const order = allOrders.find((o) => o.id === orderId);
  if (!order) return;
  reviewTargetOrder = order;
  selectedRating = 0;
  document.getElementById("reviewProductName").textContent = `${order.productName} — ${order.sellerName}`;
  updateStarDisplay();
  document.getElementById("reviewComment").value = "";
  document.getElementById("reviewOverlay").classList.add("show");
};

function closeReviewForm() {
  document.getElementById("reviewOverlay").classList.remove("show");
  reviewTargetOrder = null;
}

function updateStarDisplay() {
  document.querySelectorAll("#starPicker span").forEach((star) => {
    const val = Number(star.dataset.star);
    star.classList.toggle("star-selected", val <= selectedRating);
  });
  document.getElementById("reviewRating").value = selectedRating;
}

async function handleReviewSubmit(e) {
  e.preventDefault();
  if (!reviewTargetOrder) return;
  if (selectedRating === 0) {
    alert("कृपया कम से कम 1 स्टार दें।");
    return;
  }

  const btn = document.getElementById("reviewSubmitBtn");
  btn.disabled = true;
  btn.textContent = "भेजा जा रहा है...";

  try {
    await addDoc(collection(db, "reviews"), {
      orderId: reviewTargetOrder.id,
      sellerId: reviewTargetOrder.sellerId,
      buyerId: myUid,
      buyerName: myName,
      productName: reviewTargetOrder.productName,
      rating: selectedRating,
      comment: document.getElementById("reviewComment").value,
      createdAt: Date.now(),
    });
    reviewedOrderIds.add(reviewTargetOrder.id);
    alert("✅ धन्यवाद! आपकी रेटिंग सेव हो गई।");
    closeReviewForm();
    renderOrdersList();
  } catch (err) {
    console.error(err);
    alert("रेटिंग भेजने में दिक्कत आई।");
  } finally {
    btn.disabled = false;
    btn.textContent = "रिव्यू भेजें";
  }
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

document.getElementById("starPicker").addEventListener("click", (e) => {
  const star = e.target.closest("span");
  if (!star) return;
  selectedRating = Number(star.dataset.star);
  updateStarDisplay();
});
document.getElementById("cancelReview").addEventListener("click", closeReviewForm);
document.getElementById("reviewOverlay").addEventListener("click", (e) => { if (e.target === e.currentTarget) closeReviewForm(); });
document.getElementById("reviewForm").addEventListener("submit", handleReviewSubmit);

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html?next=my-orders.html";
    return;
  }
  myUid = user.uid;
  document.getElementById("userEmailLabel").textContent = user.email;
  document.getElementById("authLoading").style.display = "none";
  document.getElementById("pageContent").style.display = "block";

  const profileSnap = await getDoc(doc(db, "buyers", myUid));
  if (profileSnap.exists()) {
    myName = profileSnap.data().name || user.email;
    document.getElementById("buyerName") && (document.getElementById("buyerName").value = profileSnap.data().name || "");
    document.getElementById("buyerPhone") && (document.getElementById("buyerPhone").value = profileSnap.data().phone || "");
    document.getElementById("buyerAddress") && (document.getElementById("buyerAddress").value = profileSnap.data().address || "");
  } else {
    myName = user.email;
  }

  reviewedOrderIds = await fetchMyReviews(user.uid);

  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }

  // ===== रीयल-टाइम: विक्रेता Accept/Cancel करते ही तुरंत दिखे =====
  const q = query(collection(db, "orders"), where("buyerId", "==", user.uid));
  let firstLoad = true;
  onSnapshot(q, (snap) => {
    const newOrders = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    newOrders.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    if (!firstLoad) {
      newOrders.forEach((newOrder) => {
        const old = allOrders.find((o) => o.id === newOrder.id);
        if (old && old.status !== newOrder.status && newOrder.status !== "pending") {
          const statusText = newOrder.status === "accepted" ? "स्वीकार कर लिया गया ✅" : "रद्द कर दिया गया ❌";
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification("मोहल्ला बाज़ार", { body: `आपका ऑर्डर "${newOrder.productName}" ${statusText}` });
          }
        }
      });
    }

    allOrders = newOrders;
    renderOrdersList();
    firstLoad = false;
  });
});
