const db = window.firebaseDB;
const auth = window.firebaseAuth;
const { doc, getDoc, setDoc, collection, addDoc } = window.firebaseTools;
const { onAuthStateChanged } = window.authTools;

let myUid = null;
let cartItems = [];

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
    wrap.innerHTML = `<p class="empty-note">आपका कार्ट खाली है। <a href="index.html" style="color:#1B2A4A;">होमपेज पर जाकर सामान जोड़ें</a>।</p>`;
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

  const total = cartItems.reduce((s, i) => s + i.price * i.qty, 0);
  document.getElementById("cartTotalAmount").textContent = `₹${total}`;
  summary.style.display = "block";
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

function openCheckout() {
  const total = cartItems.reduce((s, i) => s + i.price * i.qty, 0);
  document.getElementById("checkoutSummary").textContent = `${cartItems.length} सामान · कुल ₹${total}`;
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

  try {
    // हर विक्रेता के लिए अलग-अलग ऑर्डर बनाना, ताकि हर सेलर सिर्फ़ अपना ऑर्डर देखे
    for (const item of cartItems) {
      await addDoc(collection(db, "orders"), {
        productId: item.productId,
        productName: item.title,
        productImg: item.img || null,
        price: item.price,
        unit: item.unit || "",
        quantity: item.qty,
        totalAmount: item.price * item.qty,
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

onAuthStateChanged(auth, async (user) => {
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
