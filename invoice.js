const db = window.firebaseDB;
const auth = window.firebaseAuth;
const { doc, getDoc } = window.firebaseTools;
const { onAuthStateChanged } = window.authTools;

function getOrderIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
}

function renderInvoice(order, orderId) {
  const date = order.createdAt
    ? new Date(order.createdAt).toLocaleDateString("hi-IN", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "";

  const statusText = order.status === "accepted" ? "✅ स्वीकृत"
    : order.status === "cancelled" ? "❌ रद्द"
    : "⏳ पेंडिंग";

  document.getElementById("invoiceContent").innerHTML = `
    <div class="invoice-header">
      <div class="invoice-logo">🏪 मोहल्ला बाज़ार</div>
      <div class="invoice-id">इनवॉइस #${orderId.slice(0, 8).toUpperCase()}</div>
    </div>

    <div class="invoice-meta">
      <div><b>तारीख:</b> ${date}</div>
      <div><b>स्थिति:</b> ${statusText}</div>
    </div>

    <div class="invoice-section">
      <h4>विक्रेता</h4>
      <p>${order.sellerName}</p>
    </div>

    <div class="invoice-section">
      <h4>खरीदार</h4>
      <p>${order.buyerName}<br>📞 ${order.buyerPhone}<br>🏠 ${order.deliveryAddress}</p>
    </div>

    <table class="invoice-table">
      <thead>
        <tr><th>सामान</th><th>मात्रा</th><th>दर</th><th>राशि</th></tr>
      </thead>
      <tbody>
        <tr>
          <td>${order.productName}</td>
          <td>${order.quantity} ${order.unit || ""}</td>
          <td>₹${order.price}</td>
          <td>₹${order.totalAmount}</td>
        </tr>
      </tbody>
    </table>

    <div class="invoice-total">
      <span>कुल राशि</span>
      <b>₹${order.totalAmount}</b>
    </div>

    ${order.note ? `<div class="invoice-section"><h4>सूचना</h4><p>${order.note}</p></div>` : ""}

    <p class="invoice-footer-note">यह एक स्वतः-जनरेट इनवॉइस है — मोहल्ला बाज़ार डेमो प्लेटफॉर्म</p>
  `;
}

document.getElementById("printBtn").addEventListener("click", () => window.print());

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }
  const orderId = getOrderIdFromUrl();
  if (!orderId) {
    document.getElementById("authLoading").innerHTML = "<p>❌ कोई ऑर्डर आईडी नहीं मिली।</p>";
    return;
  }

  try {
    const snap = await getDoc(doc(db, "orders", orderId));
    if (!snap.exists()) {
      document.getElementById("authLoading").innerHTML = "<p>❌ यह ऑर्डर नहीं मिला।</p>";
      return;
    }
    const order = snap.data();
    if (order.buyerId !== user.uid && order.sellerId !== user.uid) {
      document.getElementById("authLoading").innerHTML = "<p>❌ आपको यह इनवॉइस देखने की इजाज़त नहीं है।</p>";
      return;
    }
    document.getElementById("authLoading").style.display = "none";
    document.getElementById("invoiceBox").style.display = "block";
    renderInvoice(order, orderId);
  } catch (err) {
    console.error(err);
    document.getElementById("authLoading").innerHTML = "<p>❌ इनवॉइस लोड करने में दिक्कत आई।</p>";
  }
});
