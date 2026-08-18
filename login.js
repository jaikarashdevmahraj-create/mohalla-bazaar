const auth = window.firebaseAuth;
const db = window.firebaseDB;
const { createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged } = window.authTools;
const { doc, setDoc } = window.firebaseTools;

function showTab(tab) {
  document.getElementById("tabLogin").classList.toggle("active", tab === "login");
  document.getElementById("tabSignup").classList.toggle("active", tab === "signup");
  document.getElementById("loginBox").style.display = tab === "login" ? "block" : "none";
  document.getElementById("signupBox").style.display = tab === "signup" ? "block" : "none";
}

function showMessage(text, isError) {
  const banner = document.getElementById("successBanner");
  banner.textContent = text;
  banner.style.background = isError ? "#FDECEC" : "#E7F5EC";
  banner.style.color = isError ? "#C0392B" : "#2E7D4F";
  banner.style.borderColor = isError ? "#F5C6C6" : "#B7E4C7";
  banner.classList.add("show");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ===== कहाँ भेजना है, यह लिंक से तय होता है: login.html?next=seller.html =====
function getNextPage() {
  const params = new URLSearchParams(window.location.search);
  return params.get("next") || "index.html";
}

async function handleLogin(e) {
  e.preventDefault();
  const btn = document.getElementById("loginBtn");
  btn.disabled = true;
  btn.textContent = "लॉगिन हो रहा है...";

  const email = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginPassword").value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
    showMessage("✅ लॉगिन सफल! भेजा जा रहा है...", false);
    setTimeout(() => { window.location.href = getNextPage(); }, 800);
  } catch (err) {
    console.error(err);
    let msg = "लॉगिन नहीं हो पाया। ईमेल/पासवर्ड चेक करें।";
    if (err.code === "auth/user-not-found") msg = "यह ईमेल रजिस्टर्ड नहीं है। नया अकाउंट बनाएँ।";
    if (err.code === "auth/wrong-password") msg = "पासवर्ड गलत है।";
    if (err.code === "auth/invalid-email") msg = "ईमेल सही फॉर्मेट में नहीं है।";
    showMessage(msg, true);
    btn.disabled = false;
    btn.textContent = "लॉगिन करें";
  }
}

async function handleSignup(e) {
  e.preventDefault();
  const btn = document.getElementById("signupBtn");
  btn.disabled = true;
  btn.textContent = "अकाउंट बन रहा है...";

  const name = document.getElementById("signupName").value;
  const email = document.getElementById("signupEmail").value;
  const password = document.getElementById("signupPassword").value;
  const role = document.getElementById("signupRole").value;

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, "users", cred.user.uid), {
      name,
      email,
      role,
      createdAt: Date.now(),
    });
    showMessage("✅ अकाउंट बन गया! भेजा जा रहा है...", false);
    setTimeout(() => {
      window.location.href = role === "seller" ? "seller-profile.html" : "index.html";
    }, 800);
  } catch (err) {
    console.error(err);
    let msg = "अकाउंट नहीं बन पाया।";
    if (err.code === "auth/email-already-in-use") msg = "यह ईमेल पहले से रजिस्टर्ड है। लॉगिन करें।";
    if (err.code === "auth/weak-password") msg = "पासवर्ड कम से कम 6 अक्षर का होना चाहिए।";
    if (err.code === "auth/invalid-email") msg = "ईमेल सही फॉर्मेट में नहीं है।";
    showMessage(msg, true);
    btn.disabled = false;
    btn.textContent = "अकाउंट बनाएँ";
  }
}

// अगर पहले से लॉगिन है, तो सीधे आगे भेज दो
onAuthStateChanged(auth, (user) => {
  if (user) {
    window.location.href = getNextPage();
  }
});

document.getElementById("tabLogin").addEventListener("click", () => showTab("login"));
document.getElementById("tabSignup").addEventListener("click", () => showTab("signup"));
document.getElementById("loginForm").addEventListener("submit", handleLogin);
document.getElementById("signupForm").addEventListener("submit", handleSignup);
