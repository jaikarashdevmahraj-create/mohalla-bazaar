const db = window.firebaseDB;
const auth = window.firebaseAuth;
const { collection, query, where, getDocs, doc, setDoc, getDoc, addDoc, onSnapshot, arrayUnion, arrayRemove } = window.firebaseTools;
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

function renderTracker(status) {
  if (status === "cancelled") {
    return `<div class="tracker-cancelled">❌ यह ऑर्डर रद्द कर दिया गया है</div>`;
  }
  const steps = [
    { key: "placed", label: "ऑर्डर हुआ", emoji: "🛒" },
    { key: "accepted", label: "स्वीकार हुआ", emoji: "✅" },
    { key: "ready", label: "तैयार/भेजा", emoji: "📦" },
  ];
  const activeIdx = status === "accepted" ? 2 : 0;

  return `
    <div class="order-tracker">
      ${steps.map((s, i) => `
        <div class="tracker-step ${i <= activeIdx ? "done" : ""}">
          <div class="tracker-dot">${s.emoji}</div>
          <div class="tracker-label">${s.label}</div>
        </div>
        ${i < steps.length - 1 ? `<div class="tracker-line ${i < activeIdx ? "done" : ""}"></div>` : ""}
      `).join("")}
    </div>
  `;
}

function renderOrdersList() {
  const wrap = document.getElementById("ordersList");
  const filtered = activeFilter === "all" ? allOrders : allOrders.filter((o) => o.status === activeFilter);

  if (filtered.length === 0) {
    wrap.innerHTML = `<p class="empty-note">${window.i18n.t("noOrdersInCat")} <a href="index.html" style="color:#1B2A4A;">${window.i18n.t("noOrdersLink")}</a></p>`;
    return;
  }

  wrap.innerHTML = filtered.map((o) => {
    const st = statusLabel(o.status);
    const date = o.createdAt ? new Date(o.createdAt).toLocaleDateString("hi-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
    const cancelInfoHtml = (o.status === "cancelled" && o.cancelReason)
      ? `<div class="cancel-reason-box">❌ रद्द होने का कारण: <b>${o.cancelReason}</b>${o.cancelNote ? ` — ${o.cancelNote}` : ""}</div>`
      : "";
    const trackerHtml = renderTracker(o.status);
    const alreadyReviewed = reviewedOrderIds.has(o.id);
    const reviewBtnHtml = o.status === "accepted"
      ? (alreadyReviewed
          ? `<p class="premium-hint" style="margin-top:8px;">${window.i18n.t("alreadyRated")}</p>`
          : `<button onclick="openReview('${o.id}')" class="edit-toggle-btn" style="margin-top:8px;">${window.i18n.t("giveRating")}</button>`)
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
        ${trackerHtml}
        <div class="order-buyer-info">
          <div>🏬 विक्रेता: <b>${o.sellerName}</b></div>
          <div>🏠 डिलीवरी पता: ${o.deliveryAddress}</div>
          <div class="order-date">🕒 ${date}</div>
        </div>
        ${cancelInfoHtml}
        <a href="invoice.html?id=${o.id}" class="shop-link-btn" style="margin-top:8px;">${window.i18n.t("viewInvoice")}</a>
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

async function saveBuyerProfile(profile) {
  await setDoc(doc(db, "buyers", myUid), profile, { merge: true });
}

async function handleBuyerProfileSubmit(e) {
  e.preventDefault();
  const btn = document.getElementById("buyerProfileSubmitBtn");
  btn.disabled = true;
  btn.textContent = "सेव हो रहा है...";

  const name = document.getElementById("buyerName").value;
  const phone = document.getElementById("buyerPhone").value;
  const address = document.getElementById("buyerAddress").value;
  const label = document.getElementById("addressLabel").value || "पता";

  try {
    await saveBuyerProfile({ name, phone, address });
    await setDoc(doc(db, "buyers", myUid), {
      savedAddresses: arrayUnion({ label, address }),
    }, { merge: true });

    alert("✅ आपकी जानकारी सेव हो गई।");
    document.getElementById("buyerProfileBox").style.display = "none";
    await loadSavedAddresses();
  } catch (err) {
    console.error(err);
    alert("सेव करने में दिक्कत आई।");
  } finally {
    btn.disabled = false;
    btn.textContent = "सेव करें (नए पते के रूप में जोड़ें)";
  }
}

async function loadSavedAddresses() {
  const snap = await getDoc(doc(db, "buyers", myUid));
  const addresses = (snap.exists() && snap.data().savedAddresses) || [];
  const wrap = document.getElementById("savedAddressesList");

  if (addresses.length === 0) {
    wrap.innerHTML = "";
    return;
  }

  wrap.innerHTML = `
    <p style="font-size:12px; color:rgba(26,26,26,0.5); margin-top:10px;">सेव किए हुए पते:</p>
    ${addresses.map((a, i) => `
      <div class="saved-address-row">
        <div><b>${a.label}</b>: ${a.address}</div>
        <button type="button" onclick="removeSavedAddress(${i})" class="mini-btn delete">🗑️</button>
      </div>
    `).join("")}
  `;
}

window.removeSavedAddress = async function (idx) {
  const snap = await getDoc(doc(db, "buyers", myUid));
  const addresses = (snap.exists() && snap.data().savedAddresses) || [];
  const toRemove = addresses[idx];
  await setDoc(doc(db, "buyers", myUid), {
    savedAddresses: arrayRemove(toRemove),
  }, { merge: true });
  await loadSavedAddresses();
};

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

document.getElementById("editProfileToggleBtn").addEventListener("click", () => {
  const box = document.getElementById("buyerProfileBox");
  box.style.display = box.style.display === "none" ? "block" : "none";
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
document.getElementById("buyerProfileForm").addEventListener("submit", handleBuyerProfileSubmit);

document.getElementById("langToggleBtn").addEventListener("click", () => {
  const newLang = window.i18n.getLang() === "hi" ? "en" : "hi";
  window.i18n.setLang(newLang);
  window.i18n.applyTranslations();
  renderOrdersList();
});

onAuthStateChanged(auth, async (user) => {
  window.i18n.applyTranslations();
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
    document.getElementById("buyerName").value = profileSnap.data().name || "";
    document.getElementById("buyerPhone").value = profileSnap.data().phone || "";
    document.getElementById("buyerAddress").value = profileSnap.data().address || "";
  } else {
    myName = user.email;
  }

  allOrders = await fetchOrders(user.uid);
  reviewedOrderIds = await fetchMyReviews(user.uid);
  renderOrdersList();
  await loadSavedAddresses();
});
