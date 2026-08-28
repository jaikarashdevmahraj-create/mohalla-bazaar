const db = window.firebaseDB;
const auth = window.firebaseAuth;
const { doc, getDoc, setDoc, collection, addDoc, getDocs, query, where } = window.firebaseTools;
const { onAuthStateChanged } = window.authTools;

let myUid = null;
let cartItems = [];
let appliedDiscount = 0;
let appliedCouponCode = "";
let couponError = "";

async function fetchCart() {
  const snap = await getDoc(doc(db, "carts", myUid));
  return snap.exists() && snap.data().items ? snap.data().items : [];
}

async function saveCart() {
  await setDoc(doc(db, "carts", myUid), { items: cartItems });
}

function renderCart() {
  const wrap = document.getElementById("cartItemsList");
  const summary = document.getElementById("cartSummary");

  if (cartItems.length === 0) {
    wrap.innerHTML = `<p class="empty-note">${window.i18n.t("cartEmpty")} <a href="index.html" style="color:#1B2A4A;">${window.i18n.t("cartEmptyLink")}</a></p>`;
    summary.style.display = "none";
    return;
  }

  wrap.innerHTML = cartItems.map((item, idx) => `
    <div class="section-box order-card">
      <div class="order-card-top">
        <img src="${item.img || "https://placehold.co/70x70/EDE4D3/1B2A4A?text=📦"}" alt="${item.title}">
        <div style="flex:1;">
          <div class="product-row-title">${item.title}</div>
          <div class="product-row-price">₹${item.price} / ${item.unit || "यूनिट"}</div>
          <div style="font-size:11px; color:rgba(26,26,26,0.5);">🏬 ${item.sellerName}</div>
        </div>
      </div>
      <div class="cart-qty-row">
        <button type="button" class="qty-btn" onclick="changeQty(${idx}, -1)">−</button>
        <span class="qty-value">${item.qty}</span>
        <button type="button" class="qty-btn" onclick="changeQty(${idx}, 1)">+</button>
        <span class="cart-item-total">= ₹${item.price * item.qty}</span>
        <button type="button" class="mini-btn delete" onclick="removeItem(${idx})">🗑️</button>
      </div>
    </div>
  `).join("");

  const total = Math.max(0, cartItems.reduce((s, i) => s + i.price * i.qty, 0) - appliedDiscount);
  document.getElementById("cartTotalAmount").textContent = `₹${total}`;
  summary.style.display = "block";
  renderCouponMsg();
}

function renderCouponMsg() {
  const msg = document.getElementById("couponMsg");
  if (appliedDiscount > 0) {
    msg.innerHTML = `✅ कूपन <b>${appliedCouponCode}</b> से ₹${appliedDiscount} की छूट लागू है। <a href="#" id="removeCouponLink" style="color:#C0392B; text-decoration:underline;">हटाएँ</a>`;
    msg.style.color = "#2E7D4F";
    document.getElementById("removeCouponLink").addEventListener("click", (e) => {
      e.preventDefault();
      appliedDiscount = 0;
      appliedCouponCode = "";
      couponError = "";
      document.getElementById("couponInput").value = "";
      renderCart();
    });
  } else if (couponError) {
    msg.textContent = couponError;
    msg.style.color = "#C0392B";
  } else {
    msg.textContent = "";
  }
}

window.changeQty = async function (idx, delta) {
  cartItems[idx].qty = Math.max(1, cartItems[idx].qty + delta);
  await saveCart();
  renderCart();
};

window.removeItem = async function (idx) {
  cartItems.splice(idx, 1);
  await saveCart();
  renderCart();
};

async function applyCoupon() {
  const code = document.getElementById("couponInput").value.trim().toUpperCase();
  if (!code) return;

  const subtotal = cartItems.reduce((s, i) => s + i.price * i.qty, 0);

  const q = query(collection(db, "coupons"), where("code", "==", code));
  const snap = await getDocs(q);
  if (snap.empty) {
    couponError = "❌ यह कूपन कोड मान्य नहीं है।";
    appliedDiscount = 0;
    appliedCouponCode = "";
  } else {
    const coupon = snap.docs[0].data();
    if (coupon.expiryDate && Date.now() > coupon.expiryDate) {
      couponError = "❌ इस कूपन की समय-सीमा समाप्त हो चुकी है।";
      appliedDiscount = 0;
      appliedCouponCode = "";
    } else if (coupon.minCartValue && subtotal < coupon.minCartValue) {
      couponError = `❌ इस कूपन के लिए कम से कम ₹${coupon.minCartValue} का सामान कार्ट में होना ज़रूरी है।`;
      appliedDiscount = 0;
      appliedCouponCode = "";
    } else {
      appliedDiscount = Math.min(coupon.amount, subtotal);
      appliedCouponCode = code;
      couponError = "";
    }
  }
  renderCart();
}

document.getElementById("applyCouponBtn").addEventListener("click", applyCoupon);

async function openCheckout() {
  const total = Math.max(0, cartItems.reduce((s, i) => s + i.price * i.qty, 0) - appliedDiscount);
  document.getElementById("checkoutSummary").textContent = `${cartItems.length} सामान · कुल ₹${total}${appliedDiscount ? ` (₹${appliedDiscount} छूट)` : ""}`;

  try {
    const snap = await getDoc(doc(db, "buyers", myUid));
    if (snap.exists()) {
      const p = snap.data();
      document.getElementById("checkoutName").value = p.name || "";
      document.getElementById("checkoutPhone").value = p.phone || "";
      document.getElementById("checkoutAddress").value = p.address || "";
    }
  } catch (err) {
    console.error(err);
  }

  document.getElementById("checkoutOverlay").classList.add("show");
}
function closeCheckout() {
  document.getElementById("checkoutOverlay").classList.remove("show");
}

async function handleCheckoutSubmit(e) {
  e.preventDefault();
  const btn = document.getElementById("checkoutSubmitBtn");
  btn.disabled = true;
  btn.textContent = "भेजा जा रहा है...";

  const name = document.getElementById("checkoutName").value;
  const phone = document.getElementById("checkoutPhone").value;
  const address = document.getElementById("checkoutAddress").value;
  const note = document.getElementById("checkoutNote").value;

  const subtotal = cartItems.reduce((s, i) => s + i.price * i.qty, 0);

  try {
    for (const item of cartItems) {
      const itemTotal = item.price * item.qty;
      const itemDiscountShare = appliedDiscount > 0
        ? Math.round((itemTotal / subtotal) * appliedDiscount)
        : 0;

      await addDoc(collection(db, "orders"), {
        productId: item.productId,
        productName: item.title,
        productImg: item.img || null,
        price: item.price,
        unit: item.unit || "",
        quantity: item.qty,
        totalAmount: Math.max(0, itemTotal - itemDiscountShare),
        originalAmount: itemTotal,
        couponCode: appliedCouponCode || null,
        discountAmount: itemDiscountShare,
        sellerId: item.sellerId,
        sellerName: item.sellerName,
        buyerId: myUid,
        buyerName: name,
        buyerPhone: phone,
        deliveryAddress: address,
        note: note,
        status: "pending",
        createdAt: Date.now(),
      });
    }

    cartItems = [];
    appliedDiscount = 0;
    appliedCouponCode = "";
    couponError = "";
    await saveCart();
    alert("✅ आपके सभी ऑर्डर भेज दिए गए हैं! विक्रेताओं के स्वीकार करने का इंतज़ार करें।");
    closeCheckout();
    renderCart();
  } catch (err) {
    console.error(err);
    alert("ऑर्डर भेजने में दिक्कत आई। दोबारा कोशिश करें।");
  } finally {
    btn.disabled = false;
    btn.textContent = "सभी ऑर्डर भेजें";
  }
}

document.getElementById("checkoutBtn").addEventListener("click", openCheckout);
document.getElementById("cancelCheckout").addEventListener("click", closeCheckout);
document.getElementById("checkoutOverlay").addEventListener("click", (e) => { if (e.target === e.currentTarget) closeCheckout(); });
document.getElementById("checkoutForm").addEventListener("submit", handleCheckoutSubmit);

document.getElementById("langToggleBtn").addEventListener("click", () => {
  const newLang = window.i18n.getLang() === "hi" ? "en" : "hi";
  window.i18n.setLang(newLang);
  window.i18n.applyTranslations();
  renderCart();
});

onAuthStateChanged(auth, async (user) => {
  window.i18n.applyTranslations();
  if (!user) {
    window.location.href = "login.html?next=cart.html";
    return;
  }
  myUid = user.uid;
  document.getElementById("authLoading").style.display = "none";
  document.getElementById("pageContent").style.display = "block";

  cartItems = await fetchCart();
  renderCart();
});
