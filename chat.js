const db = window.firebaseDB;
const auth = window.firebaseAuth;
const { collection, doc, addDoc, query, where, orderBy, onSnapshot, getDoc, setDoc } = window.firebaseTools;
const { onAuthStateChanged } = window.authTools;

let myUid = null;
let otherUid = null;
let chatId = null;

function getParams() {
  const params = new URLSearchParams(window.location.search);
  return { sellerId: params.get("sellerId"), sellerName: params.get("sellerName") };
}

function buildChatId(uid1, uid2) {
  return [uid1, uid2].sort().join("_");
}

function renderMessages(messages) {
  const wrap = document.getElementById("chatMessages");
  wrap.innerHTML = messages.map((m) => `
    <div class="chat-bubble ${m.senderId === myUid ? "mine" : "theirs"}">
      <div class="chat-bubble-text">${m.text}</div>
      <div class="chat-bubble-time">${new Date(m.createdAt).toLocaleTimeString("hi-IN", { hour: "2-digit", minute: "2-digit" })}</div>
    </div>
  `).join("");
  wrap.scrollTop = wrap.scrollHeight;
}

async function sendMessage(text) {
  await addDoc(collection(db, "chats", chatId, "messages"), {
    text,
    senderId: myUid,
    receiverId: otherUid,
    createdAt: Date.now(),
  });
  await setDoc(doc(db, "chats", chatId), {
    participants: [myUid, otherUid],
    lastMessage: text,
    lastMessageAt: Date.now(),
  }, { merge: true });
}

document.getElementById("chatForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const input = document.getElementById("chatInput");
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  await sendMessage(text);
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html?next=" + encodeURIComponent(window.location.pathname + window.location.search);
    return;
  }
  myUid = user.uid;

  const { sellerId, sellerName } = getParams();
  if (!sellerId) {
    document.getElementById("authLoading").innerHTML = "<p>❌ कोई विक्रेता नहीं मिला।</p>";
    return;
  }
  otherUid = sellerId;
  chatId = buildChatId(myUid, otherUid);
  document.getElementById("chatWithName").textContent = sellerName || "चैट";

  document.getElementById("authLoading").style.display = "none";
  document.getElementById("chatContent").style.display = "block";

  const q = query(collection(db, "chats", chatId, "messages"), orderBy("createdAt", "asc"));
  onSnapshot(q, (snap) => {
    const messages = snap.docs.map((d) => d.data());
    renderMessages(messages);
  });
});
