const db = window.firebaseDB;
const auth = window.firebaseAuth;
const { doc, getDoc, getDocs, collection, setDoc, arrayRemove } = window.firebaseTools;
const { onAuthStateChanged } = window.authTools;

let myUid = null;
let wishlistItems = [];

async function loadWishlistItems() {
  const wSnap = await getDoc(doc(db, "wishlists", myUid));
  const ids = wSnap.exists() && wSnap.data().productIds ? wSnap.data().productIds : [];

  const items = [];
  for (const id of ids) {
    try {
      const pSnap = await getDoc(doc(db, "products", id));
      if (pSnap.exists()) {
        const p = pSnap.data();
        let sellerName = "दुकान", sellerLogo = null, isPremiumSeller = false;
        try {
          const sSnap = await getDoc(doc(db, "sellers", p.sellerId));
          if (sSnap.exists()) {
            sellerName = sSnap.data().shopName;
            sellerLogo = sSnap.data().logo;
            isPremiumSeller = !!sSnap.data().isPremium;
          }
        } catch (e) {}
        items.push({
          id,
          title: p.name + (p.unit ? ` (${p.unit})` : ""),
          price: p.price,
          img: (p.images && p.images[0]) || p.img || null,
          images: p.images || (p.img ? [p.img] : []),
          unit: p.unit,
          stock: p.stock,
          sellerId: p.sellerId,
          sellerName,
          sellerLogo,
          isPremiumSeller,
          dist: "आपके आसपास",
        });
      }
    } catch (e) {}
  }
  return items;
}

function renderWishlist() {
  const grid = document.getElementById("wishlistGrid");
  if (wishlistItems.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-emoji">💔</div>
        <p class="empty-state-title">अभी कुछ भी पसंद में नहीं है</p>
        <p class="empty-state-sub"><a href="index.html" style="color:#1B2A4A;">होमपेज पर जाकर सामान पसंद करें</a></p>
      </div>`;
    return;
  }

  grid.innerHTML = "";
  wishlistItems.forEach((item) => {
    const card = document.createElement("div");
    card.className = "card";
    const imgSrc = item.img || "https://placehold.co/400x300/EDE4D3/1B2A4A?text=📦";
    card.innerHTML = `
      <img src="${imgSrc}" alt="${item.title}">
      <button class="wishlist-heart active" data-id="${item.id}">❤️</button>
      <div class="card-body">
        <div class="card-title">${item.title}</div>
        <div class="card-price">₹${item.price}</div>
        <div class="card-seller">🏬 ${item.sellerName}</div>
      </div>`;
    card.addEventListener("click", () => openDetail(item));
    card.querySelector(".wishlist-heart").addEventListener("click", async (e) => {
      e.stopPropagation();
      await setDoc(doc(db, "wishlists", myUid), { productIds: arrayRemove(item.id) }, { merge: true });
      wishlistItems = wishlistItems.filter((w) => w.id !== item.id);
      renderWishlist();
    });
    grid.appendChild(card);
  });
}

function openDetail(item) {
  const modal = document.getElementById("detailModal");
  const imgSrc = item.img || "https://placehold.co/400x300/EDE4D3/1B2A4A?text=📦";
  const logoSrc = item.sellerLogo || "https://placehold.co/80x80/1B2A4A/FFFFFF?text=🏬";

  modal.innerHTML = `
    <img src="${imgSrc}" alt="${item.title}">
    <h2>${item.title}</h2>
    <div class="card-price" style="font-size:22px;">₹${item.price}</div>

    <div class="seller-box">
      <img class="seller-avatar-img" src="${logoSrc}" alt="shop logo">
      <div class="seller-info">
        <div class="seller-name">${item.sellerName} ${item.isPremiumSeller ? '<span class="verified-badge">✔️ वेरिफाइड</span>' : ""}</div>
      </div>
    </div>

    <a href="index.html" class="shop-link-btn">🏠 होमपेज पर जाकर ऑर्डर करें</a>
    <button class="btn-secondary" id="closeDetail">बंद करें</button>
  `;
  document.getElementById("detailOverlay").classList.add("show");
  document.getElementById("closeDetail").addEventListener("click", () => {
    document.getElementById("detailOverlay").classList.remove("show");
  });
}

document.getElementById("detailOverlay").addEventListener("click", (e) => {
  if (e.target === e.currentTarget) document.getElementById("detailOverlay").classList.remove("show");
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html?next=wishlist.html";
    return;
  }
  myUid = user.uid;
  document.getElementById("authLoading").style.display = "none";
  document.getElementById("pageContent").style.display = "block";

  wishlistItems = await loadWishlistItems();
  renderWishlist();
});
