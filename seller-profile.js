const db = window.firebaseDB;
const { doc, setDoc, getDoc, deleteDoc } = window.firebaseTools;
const mySellerId = window.getMySellerId();

function isPremium() {
  return localStorage.getItem("isPremiumSeller") === "true";
}
function getProductCount() {
  const data = localStorage.getItem("mySellerProducts");
  return data ? JSON.parse(data).length : 0;
}
function generateShopId() {
  const random = Math.floor(100000 + Math.random() * 900000);
  return "MB-" + random;
}

let bannerImg = null;
let logoImg = null;
let currentProfile = null;

function resizeImage(file, maxSize, quality, callback) {
  const reader = new FileReader();
  reader.onload = function (e) {
    const img = new Image();
    img.onload = function () {
      let w = img.width, h = img.height;
      if (w > h && w > maxSize) { h = Math.round((h * maxSize) / w); w = maxSize; }
      else if (h >= w && h > maxSize) { w = Math.round((w * maxSize) / h); h = maxSize; }
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      callback(canvas.toDataURL("image/jpeg", quality));
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

async function fetchProfile() {
  try {
    const snap = await getDoc(doc(db, "sellers", mySellerId));
    return snap.exists() ? snap.data() : null;
  } catch (err) {
    console.error("Profile load error:", err);
    return null;
  }
}

async function saveProfileToFirebase(profile) {
  await setDoc(doc(db, "sellers", mySellerId), profile);
}

function showForm() {
  document.getElementById("formSectionBox").style.display = "block";
  document.getElementById("editToggleBtn").style.display = "none";
  const hasProfile = !!currentProfile;
  document.getElementById("cancelEditProfile").style.display = hasProfile ? "block" : "none";
  document.getElementById("formSectionTitle").textContent = hasProfile
    ? "दुकान की जानकारी बदलें"
    : "दुकान की जानकारी भरें";
}
function hideForm() {
  document.getElementById("formSectionBox").style.display = "none";
  document.getElementById("editToggleBtn").style.display = "block";
}

function renderStorefront() {
  const p = currentProfile;
  const box = document.getElementById("storefrontPreview");

  if (!p) {
    box.innerHTML = `
      <div class="storefront-empty">
        <p>🏬 अभी आपकी दुकान की प्रोफाइल नहीं बनी है।</p>
        <p class="premium-hint">नीचे फॉर्म भरकर अपनी दुकान बनाइए — रजिस्ट्रेशन होते ही आपको एक यूनीक शॉप आईडी मिलेगी।</p>
      </div>
    `;
    showForm();
    return;
  }

  const premium = isPremium();
  const banner = p.banner || "https://placehold.co/600x200/1B2A4A/FFFFFF?text=दुकान+की+फोटो";
  const logo = p.logo || "https://placehold.co/120x120/E8A33D/1B2A4A?text=🏪";
  const addressLine = [p.village, p.tehsil, p.district, p.state].filter(Boolean).join(", ");

  box.innerHTML = `
    <div class="storefront-banner" style="background-image:url('${banner}')"></div>
    <div class="storefront-body">
      <img class="storefront-logo" src="${logo}" alt="logo">
      <div class="storefront-info">
        <div class="storefront-name">${p.shopName} ${premium ? '<span class="verified-badge">✔️ वेरिफाइड</span>' : ""}</div>
        <div class="storefront-owner">👤 ${p.ownerName}</div>
        <div class="storefront-area">📍 ${addressLine} — ${p.pincode}</div>
      </div>
    </div>
    <div class="shop-id-badge">🆔 शॉप आईडी: <b>${p.shopId}</b></div>
    ${p.description ? `<p class="storefront-desc">${p.description}</p>` : ""}
    <div class="storefront-address-box"><span>🏠 पूरा पता:</span> ${p.fullAddress}</div>
    <div class="storefront-stats">
      <div><b>${getProductCount()}</b><span>सामान लिस्टेड</span></div>
      <div><b>${p.joinedLabel}</b><span>से सदस्य</span></div>
      <div><b>${premium ? "⭐ प्रीमियम" : "मुफ़्त"}</b><span>प्लान</span></div>
    </div>
    <div class="storefront-contact">📞 ${p.phone}</div>
  `;
}

function loadFormFromProfile() {
  const p = currentProfile;
  if (!p) return;
  document.getElementById("shopName").value = p.shopName || "";
  document.getElementById("ownerName").value = p.ownerName || "";
  document.getElementById("phone").value = p.phone || "";
  document.getElementById("state").value = p.state || "";
  document.getElementById("district").value = p.district || "";
  document.getElementById("tehsil").value = p.tehsil || "";
  document.getElementById("village").value = p.village || "";
  document.getElementById("pincode").value = p.pincode || "";
  document.getElementById("fullAddress").value = p.fullAddress || "";
  document.getElementById("description").value = p.description || "";
  if (p.banner) {
    bannerImg = p.banner;
    document.getElementById("bannerPreview").src = p.banner;
    document.getElementById("bannerPreviewWrap").style.display = "block";
  }
  if (p.logo) {
    logoImg = p.logo;
    document.getElementById("logoPreview").src = p.logo;
    document.getElementById("logoPreviewWrap").style.display = "block";
  }
}

function handleBannerSelect(e) {
  const file = e.target.files[0];
  if (!file) return;
  resizeImage(file, 700, 0.7, (dataUrl) => {
    bannerImg = dataUrl;
    document.getElementById("bannerPreview").src = dataUrl;
    document.getElementById("bannerPreviewWrap").style.display = "block";
  });
}
function handleLogoSelect(e) {
  const file = e.target.files[0];
  if (!file) return;
  resizeImage(file, 250, 0.75, (dataUrl) => {
    logoImg = dataUrl;
    document.getElementById("logoPreview").src = dataUrl;
    document.getElementById("logoPreviewWrap").style.display = "block";
  });
}

async function handleProfileSubmit(e) {
  e.preventDefault();
  const submitBtn = document.getElementById("profileSubmitBtn");
  submitBtn.disabled = true;
  submitBtn.textContent = "सेव हो रहा है...";

  const existing = currentProfile;
  const profile = {
    shopName: document.getElementById("shopName").value,
    ownerName: document.getElementById("ownerName").value,
    phone: document.getElementById("phone").value,
    state: document.getElementById("state").value,
    district: document.getElementById("district").value,
    tehsil: document.getElementById("tehsil").value,
    village: document.getElementById("village").value,
    pincode: document.getElementById("pincode").value,
    fullAddress: document.getElementById("fullAddress").value,
    description: document.getElementById("description").value,
    banner: bannerImg,
    logo: logoImg,
    shopId: (existing && existing.shopId) ? existing.shopId : generateShopId(),
    joinedLabel: existing
      ? existing.joinedLabel
      : new Date().toLocaleDateString("hi-IN", { month: "long", year: "numeric" }),
  };

  try {
    await saveProfileToFirebase(profile);
    currentProfile = profile;
    renderStorefront();
    hideForm();

    const banner = document.getElementById("successBanner");
    banner.classList.add("show");
    window.scrollTo({ top: 0, behavior: "smooth" });
    setTimeout(() => banner.classList.remove("show"), 3000);
  } catch (err) {
    console.error(err);
    alert("सेव करने में दिक्कत आई। इंटरनेट चेक करके दोबारा कोशिश करें।");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "प्रोफाइल सेव करें";
  }
}

async function deleteSellerAccount() {
  const sure = confirm("⚠️ क्या आप वाकई अपना पूरा सेलर अकाउंट डिलीट करना चाहते हैं?\n\nइससे आपकी दुकान की प्रोफाइल, शॉप आईडी, सारा सामान, और प्रीमियम स्टेटस — सब हमेशा के लिए मिट जाएगा।");
  if (!sure) return;
  const doubleSure = confirm("पक्का? यह वापस नहीं होगा।");
  if (!doubleSure) return;

  try {
    await deleteDoc(doc(db, "sellers", mySellerId));
  } catch (err) {
    console.error(err);
  }

  localStorage.removeItem("mySellerProducts");
  localStorage.removeItem("isPremiumSeller");
  localStorage.removeItem("myDeviceSellerId");

  alert("आपका सेलर अकाउंट डिलीट हो गया। अब आप नए सिरे से रजिस्ट्रेशन कर सकते हैं।");
  location.reload();
}

function renderDeleteButton() {
  document.getElementById("deleteAccountBtn").style.display = currentProfile ? "block" : "none";
}

async function init() {
  document.getElementById("storefrontPreview").innerHTML =
    '<p class="empty-note">लोड हो रहा है...</p>';

  currentProfile = await fetchProfile();
  loadFormFromProfile();
  renderStorefront();
  renderDeleteButton();
  if (currentProfile) hideForm();
}

document.getElementById("profileForm").addEventListener("submit", handleProfileSubmit);
document.getElementById("bannerFile").addEventListener("change", handleBannerSelect);
document.getElementById("logoFile").addEventListener("change", handleLogoSelect);
document.getElementById("editToggleBtn").addEventListener("click", showForm);
document.getElementById("cancelEditProfile").addEventListener("click", () => {
  loadFormFromProfile();
  hideForm();
});
document.getElementById("deleteAccountBtn").addEventListener("click", deleteSellerAccount);

init();
