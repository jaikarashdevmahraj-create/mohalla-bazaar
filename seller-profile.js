function getProfile() {
  const data = localStorage.getItem("sellerProfile");
  return data ? JSON.parse(data) : null;
}
function saveProfile(p) {
  localStorage.setItem("sellerProfile", JSON.stringify(p));
}
function isPremium() {
  return localStorage.getItem("isPremiumSeller") === "true";
}
function getProductCount() {
  const data = localStorage.getItem("mySellerProducts");
  return data ? JSON.parse(data).length : 0;
}

let bannerImg = null;
let logoImg = null;

function resizeImage(file, maxSize, callback) {
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
      callback(canvas.toDataURL("image/jpeg", 0.75));
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// ===== फॉर्म दिखाना/छुपाना =====
function showForm() {
  document.getElementById("formSectionBox").style.display = "block";
  document.getElementById("editToggleBtn").style.display = "none";
  const hasProfile = !!getProfile();
  document.getElementById("cancelEditProfile").style.display = hasProfile ? "block" : "none";
  document.getElementById("formSectionTitle").textContent = hasProfile
    ? "दुकान की जानकारी बदलें"
    : "दुकान की जानकारी भरें";
}

function hideForm() {
  document.getElementById("formSectionBox").style.display = "none";
  document.getElementById("editToggleBtn").style.display = "block";
}

// ===== दुकान का प्रीव्यू =====
function renderStorefront() {
  const p = getProfile();
  const box = document.getElementById("storefrontPreview");

  if (!p) {
    box.innerHTML = `
      <div class="storefront-empty">
        <p>🏬 अभी आपकी दुकान की प्रोफाइल नहीं बनी है।</p>
        <p class="premium-hint">नीचे फॉर्म भरकर अपनी दुकान बनाइए — यह वैसे ही दिखेगी जैसे ग्राहकों को दिखती है।</p>
      </div>
    `;
    showForm(); // प्रोफाइल न हो तो फॉर्म हमेशा खुला रहे
    return;
  }

  const premium = isPremium();
  const banner = p.banner || "https://placehold.co/600x200/1B2A4A/FFFFFF?text=दुकान+की+फोटो";
  const logo = p.logo || "https://placehold.co/120x120/E8A33D/1B2A4A?text=🏪";

  const addressLine = [p.village, p.tehsil, p.district, p.state]
    .filter(Boolean)
    .join(", ");

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
    ${p.description ? `<p class="storefront-desc">${p.description}</p>` : ""}
    <div class="storefront-address-box">
      <span>🏠 पूरा पता:</span> ${p.fullAddress}
    </div>
    <div class="storefront-stats">
      <div><b>${getProductCount()}</b><span>सामान लिस्टेड</span></div>
      <div><b>${p.joinedLabel}</b><span>से सदस्य</span></div>
      <div><b>${premium ? "⭐ प्रीमियम" : "मुफ़्त"}</b><span>प्लान</span></div>
    </div>
    <div class="storefront-contact">📞 ${p.phone}</div>
  `;
}

// ===== फॉर्म में पुरानी जानकारी भरना =====
function loadFormFromProfile() {
  const p = getProfile();
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
  resizeImage(file, 900, (dataUrl) => {
    bannerImg = dataUrl;
    document.getElementById("bannerPreview").src = dataUrl;
    document.getElementById("bannerPreviewWrap").style.display = "block";
  });
}

function handleLogoSelect(e) {
  const file = e.target.files[0];
  if (!file) return;
  resizeImage(file, 300, (dataUrl) => {
    logoImg = dataUrl;
    document.getElementById("logoPreview").src = dataUrl;
    document.getElementById("logoPreviewWrap").style.display = "block";
  });
}

function handleProfileSubmit(e) {
  e.preventDefault();
  const existing = getProfile();

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
    joinedLabel: existing
      ? existing.joinedLabel
      : new Date().toLocaleDateString("hi-IN", { month: "long", year: "numeric" }),
  };

  saveProfile(profile);
  renderStorefront();
  hideForm(); // सेव होते ही फॉर्म बंद, सिर्फ़ "बदलें" बटन दिखेगा

  const banner = document.getElementById("successBanner");
  banner.classList.add("show");
  window.scrollTo({ top: 0, behavior: "smooth" });
  setTimeout(() => banner.classList.remove("show"), 3000);
}

document.getElementById("profileForm").addEventListener("submit", handleProfileSubmit);
document.getElementById("bannerFile").addEventListener("change", handleBannerSelect);
document.getElementById("logoFile").addEventListener("change", handleLogoSelect);
document.getElementById("editToggleBtn").addEventListener("click", showForm);
document.getElementById("cancelEditProfile").addEventListener("click", () => {
  loadFormFromProfile(); // बदलाव रद्द करके पुरानी जानकारी वापस भरना
  hideForm();
});

loadFormFromProfile();
renderStorefront();

// पेज खुलते वक्त अगर प्रोफाइल पहले से बनी है, तो फॉर्म छुपा रहे
if (getProfile()) {
  hideForm();
}
