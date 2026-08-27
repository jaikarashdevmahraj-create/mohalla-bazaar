const db = window.firebaseDB;
const auth = window.firebaseAuth;
const { collection, doc, getDoc, getDocs, setDoc, query, where, limit, arrayUnion, arrayRemove, documentId } = window.firebaseTools;
const { onAuthStateChanged } = window.authTools;

let currentUser = null;
let followedIds = new Set();
let activeTab = "famous";
let myLat = null;
let myLng = null;
const tabCache = {};

function getMyLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        myLat = pos.coords.latitude;
        myLng = pos.coords.longitude;
        resolve();
      },
      () => resolve(),
      { timeout: 5000 }
    );
  });
}

function calcDistanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function formatDistance(km) {
  if (km < 1) return `${Math.round(km * 1000)} मीटर`;
  return `${km.toFixed(1)} किमी`;
}

async function fetchFollowedIds() {
  if (!currentUser) return new Set();
  const snap = await getDoc(doc(db, "follows", currentUser.uid));
  return snap.exists() && snap.data().sellerIds ? new Set(snap.data().sellerIds) : new Set();
}

async function fetchFamousSellers() {
  const q = query(collection(db, "sellers"), where("isPremium", "==", true), limit(30));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function fetchNearbySellers() {
  await getMyLocation();
  const snap = await getDocs(collection(db, "sellers"));
  const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  if (myLat == null) return all;
  return all
    .map((s) => ({
      ...s,
      distKm: (s.lat && s.lng) ? calcDistanceKm(myLat, myLng, s.lat, s.lng) : null,
    }))
    .sort((a, b) => {
      if (a.distKm == null) return 1;
      if (b.distKm == null) return -1;
      return a.distKm - b.distKm;
    });
}

async function fetchFollowedSellers() {
  if (!currentUser) return [];
  const ids = [...followedIds];
  if (ids.length === 0) return [];
  const chunks = [];
  for (let i = 0; i < ids.length; i += 10) chunks.push(ids.slice(i, i + 10));
  const results = [];
  for (const chunk of chunks) {
    const q = query(collection(db, "sellers"), where(documentId(), "in", chunk));
    const snap = await getDocs(q);
    snap.docs.forEach((d) => results.push({ id: d.id, ...d.data() }));
  }
  return results;
}

function emptyStateHtml(emoji, textKey, showLoginLink) {
  return `
    <div class="empty-state">
      <div class="empty-state-emoji">${emoji}</div>
      <p class="empty-state-title">${window.i18n.t(textKey)}</p>
      ${showLoginLink ? `<p class="empty-state-sub"><a href="login.html?next=sellers.html" style="color:#1B2A4A;">${window.i18n.t("login")}</a></p>` : ""}
    </div>`;
}

function renderSellerList(list) {
  const box = document.getElementById("sellerListBox");

  if (activeTab === "followed" && !currentUser) {
    box.innerHTML = emptyStateHtml("❤️", "sellersEmptyFollowed", true);
    return;
  }

  if (!list.length) {
    const key = activeTab === "famous" ? "sellersEmptyFamous" : activeTab === "nearby" ? "sellersEmptyNearby" : "sellersEmptyFollowed";
    box.innerHTML = emptyStateHtml(activeTab === "famous" ? "⭐" : activeTab === "nearby" ? "📍" : "❤️", key, false);
    return;
  }

  box.innerHTML = "";
  list.forEach((s) => {
    const card = document.createElement("div");
    card.className = "seller-list-card";
    const logo = s.logo || "https://placehold.co/120x120/E8A33D/1B2A4A?text=🏪";
    const area = [s.village, s.district].filter(Boolean).join(", ") || "इलाका उपलब्ध नहीं";
    const distLabel = (activeTab === "nearby" && s.distKm != null) ? formatDistance(s.distKm) : area;
    const isFollowing = followedIds.has(s.id);
    card.innerHTML = `
      <img src="${logo}" alt="${s.shopName || ''}">
      <div class="seller-list-info">
        <div class="seller-list-name">${s.shopName || "दुकान"} ${s.isPremium ? '<span class="verified-badge">✔️</span>' : ""}</div>
        <div class="seller-list-area">📍 ${distLabel}</div>
      </div>
      <button type="button" class="follow-btn ${isFollowing ? "following" : ""}" data-id="${s.id}">
        ${isFollowing ? window.i18n.t("followingBtn") : window.i18n.t("followBtn")}
      </button>
    `;
    card.addEventListener("click", () => {
      window.location.href = `shop.html?sellerId=${s.id}`;
    });
    card.querySelector(".follow-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      toggleFollow(s.id);
    });
    box.appendChild(card);
  });
}

async function toggleFollow(sellerId) {
  if (!currentUser) {
    alert(window.i18n.t("loginToFollow"));
    window.location.href = "login.html?next=sellers.html";
    return;
  }
  try {
    if (followedIds.has(sellerId)) {
      await setDoc(doc(db, "follows", currentUser.uid), { sellerIds: arrayRemove(sellerId) }, { merge: true });
      followedIds.delete(sellerId);
    } else {
      await setDoc(doc(db, "follows", currentUser.uid), { sellerIds: arrayUnion(sellerId) }, { merge: true });
      followedIds.add(sellerId);
    }
    delete tabCache.followed; // followed list ko refresh karna hoga
    renderCurrentTab();
  } catch (err) {
    console.error(err);
    alert("दिक्कत आई, दोबारा कोशिश करें।");
  }
}

async function renderCurrentTab() {
  const box = document.getElementById("sellerListBox");
  box.innerHTML = `<p class="empty-note">${window.i18n.t("loading")}</p>`;

  if (activeTab === "followed" && !currentUser) {
    renderSellerList([]);
    return;
  }

  try {
    if (!tabCache[activeTab]) {
      if (activeTab === "famous") tabCache.famous = await fetchFamousSellers();
      else if (activeTab === "nearby") tabCache.nearby = await fetchNearbySellers();
      else if (activeTab === "followed") tabCache.followed = await fetchFollowedSellers();
    }
    renderSellerList(tabCache[activeTab] || []);
  } catch (err) {
    console.error(err);
    box.innerHTML = `<p class="empty-note">कुछ गड़बड़ हो गई, दोबारा कोशिश करें।</p>`;
  }
}

document.getElementById("sellerTabs").addEventListener("click", (e) => {
  const btn = e.target.closest(".order-tab");
  if (!btn) return;
  activeTab = btn.dataset.tab;
  document.querySelectorAll("#sellerTabs .order-tab").forEach((t) => t.classList.remove("active"));
  btn.classList.add("active");
  renderCurrentTab();
});

document.getElementById("langToggleBtn").addEventListener("click", () => {
  const newLang = window.i18n.getLang() === "hi" ? "en" : "hi";
  window.i18n.setLang(newLang);
  window.i18n.applyTranslations();
  renderCurrentTab();
});

window.i18n.applyTranslations();

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  followedIds = user ? await fetchFollowedIds() : new Set();
  renderCurrentTab();
});
        
