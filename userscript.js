
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  getDoc,
  addDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// --- Firebase Config ---
const firebaseConfig = {
  apiKey: "AIzaSyBWyOxjy0RRiZ9EzokSGAqY8VS0EUm4eqU",
  authDomain: "homie-kitchen.firebaseapp.com",
  projectId: "homie-kitchen",
  storageBucket: "homie-kitchen.appspot.com",
  messagingSenderId: "528858035640",
  appId: "1:528858035640:web:b1079d2f2fe048287b0b4d"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- Set Auth Persistence ---
setPersistence(auth, browserLocalPersistence)
  .then(() => console.log("[AUTH] Persistence set to local"))
  .catch((error) => console.error("[AUTH] Failed to set persistence", error));

// --- Tab Switching ---
window.switchTab = function(tab) {
  document.querySelectorAll('.tabs button').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.form').forEach(form => form.classList.remove('active'));

  if (tab === 'login') {
    document.querySelectorAll('.tabs button')[0].classList.add('active');
    document.getElementById('loginForm').classList.add('active');
  } else {
    document.querySelectorAll('.tabs button')[1].classList.add('active');
    document.getElementById('signupForm').classList.add('active');
  }
};

// --- Login ---
window.login = function() {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value.trim();
  if (!email || !password) return alert('Please fill all fields');

  console.log(`[LOGIN] Attempting login for: ${email}`);
  signInWithEmailAndPassword(auth, email, password)
    .then(() => {
      console.log(`[LOGIN] Success for: ${email}`);
      document.getElementById('authOverlay').style.display = 'none';
      loadMenu();
    })
    .catch(err => {
      console.error(`[LOGIN] Failed for ${email}: ${err.message}`);
      alert("Login failed: " + err.message);
    });
};

// --- Signup ---
window.signup = function() {
  const name = document.getElementById('signupName').value.trim();
  const email = document.getElementById('signupEmail').value.trim();
  const password = document.getElementById('signupPassword').value.trim();
  if (!name || !email || !password) return alert('Please fill all fields');

  console.log(`[SIGNUP] Attempting signup for: ${email} (Name: ${name})`);
  createUserWithEmailAndPassword(auth, email, password)
    .then(() => {
      console.log(`[SIGNUP] Success for: ${email}`);
      document.getElementById('authOverlay').style.display = 'none';
      loadMenu();
    })
    .catch(err => {
      console.error(`[SIGNUP] Failed for ${email}: ${err.message}`);
      alert("Signup failed: " + err.message);
    });
};

// --- Profile ---
document.querySelector(".bar button:last-child").addEventListener("click", () => {
  document.getElementById("cartPopup").style.display = "none";
  document.getElementById("ordersPopup").style.display = "none";
  const profilePopup = document.getElementById("profilePopup");
  profilePopup.style.display = profilePopup.style.display === "block" ? "none" : "block";
});

document.getElementById("viewProfileBtn").addEventListener("click", async () => {
  const user = auth.currentUser;
  if (!user) return alert("No user logged in");

  const userRef = doc(db, "users", user.email);
  const userSnap = await getDoc(userRef);
  document.getElementById("profileName").value = userSnap.exists() ? userSnap.data().name : "";
  document.getElementById("profileEmail").value = user.email;
  document.getElementById("profileEditOverlay").style.display = "flex";
  document.getElementById("profilePopup").style.display = "none";
});

document.getElementById("logoutBtn").addEventListener("click", () => {
  signOut(auth).then(() => {
    console.log(`[LOGOUT] User logged out`);
    location.reload();
  }).catch(err => alert("Logout failed: " + err.message));
});

window.saveProfile = async function() {
  const name = document.getElementById("profileName").value.trim();
  const email = document.getElementById("profileEmail").value;
  if (!name) return alert("Name cannot be empty");

  await setDoc(doc(db, "users", email), { name }, { merge: true });
  alert("Profile updated!");
  closeProfilePopup();
};

window.closeProfilePopup = function() {
  document.getElementById("profileEditOverlay").style.display = "none";
};

// --- Menu ---
async function loadMenu() {
  const menuRef = collection(db, "menu");
  const snapshot = await getDocs(menuRef);
  const container = document.getElementById("menuItems");
  container.innerHTML = "";

  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    const div = document.createElement("div");
    div.className = "menu-card";
    div.innerHTML = `
      <h3>${data.name}</h3>
      <p>${data.description || ''}</p>
      <span>₹${data.price}</span><br><br>
      <button data-name="${data.name}" data-price="${data.price}">Add to Cart</button>
    `;
    container.appendChild(div);
  });

  document.querySelectorAll(".menu-card button").forEach(btn => {
    btn.addEventListener("click", () => {
      const name = btn.getAttribute("data-name");
      const price = parseFloat(btn.getAttribute("data-price"));
      addToCart(name, price);
    });
  });
}

// --- Cart ---
async function addToCart(name, price) {
  const user = auth.currentUser;
  if (!user) return alert("Please login to add to cart.");
  const itemRef = doc(db, `carts/${user.email}/items/${name}`);
  const itemSnap = await getDoc(itemRef);

  if (itemSnap.exists()) {
    const data = itemSnap.data();
    await setDoc(itemRef, { name, price, quantity: data.quantity + 1 });
  } else {
    await setDoc(itemRef, { name, price, quantity: 1 });
  }

  loadPopupCart();
}

async function removeFromCart(name) {
  const user = auth.currentUser;
  if (!user) return;
  await deleteDoc(doc(db, `carts/${user.email}/items/${name}`));
  loadPopupCart();
}

async function loadPopupCart() {
  const user = auth.currentUser;
  if (!user) return;
  const cartRef = collection(db, `carts/${user.email}/items`);
  const snapshot = await getDocs(cartRef);
  const container = document.getElementById("popupCartItems");
  container.innerHTML = "";

  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    const div = document.createElement("div");
    div.className = "cart-item";
    div.innerHTML = `
      <span>${data.name} x${data.quantity} - ₹${data.price * data.quantity}</span>
      <button class="remove-btn" data-name="${data.name}">✖</button>
    `;
    container.appendChild(div);
  });

  container.querySelectorAll(".remove-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const name = btn.getAttribute("data-name");
      removeFromCart(name);
    });
  });
}

// --- Navbar Buttons ---
document.getElementById("menuBtn").addEventListener("click", () => {
  document.getElementById("menuSection").scrollIntoView({ behavior: 'smooth' });
});

document.getElementById("cartBtn").addEventListener("click", async () => {
  document.getElementById("ordersPopup").style.display = "none";
  document.getElementById("profilePopup").style.display = "none";
  const cartPopup = document.getElementById("cartPopup");
  if (cartPopup.style.display === "none" || cartPopup.style.display === "") {
    await loadPopupCart();
    cartPopup.style.display = "block";
  } else {
    cartPopup.style.display = "none";
  }
});

document.getElementById("ordersBtn").addEventListener("click", async () => {
  document.getElementById("cartPopup").style.display = "none";
  document.getElementById("profilePopup").style.display = "none";
  const ordersPopup = document.getElementById("ordersPopup");
  if (ordersPopup.style.display === "none" || ordersPopup.style.display === "") {
    await loadUserOrders();
    ordersPopup.style.display = "block";
  } else {
    ordersPopup.style.display = "none";
  }
});

// --- Place Order ---
document.getElementById("placeOrderBtn").addEventListener("click", async () => {
  const user = auth.currentUser;
  if (!user) return alert("Please login to place an order.");

  const cartRef = collection(db, `carts/${user.email}/items`);
  const snapshot = await getDocs(cartRef);
  if (snapshot.empty) return alert("Cart is empty!");

  const items = [];
  let total = 0;
  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    items.push(data);
    total += data.price * data.quantity;
  });

  const order = { items, total, timestamp: new Date().toISOString() };
  await addDoc(collection(db, `orders/${user.email}/history`), order);

  const batchDeletes = snapshot.docs.map(d => deleteDoc(doc(db, `carts/${user.email}/items/${d.id}`)));
  await Promise.all(batchDeletes);

  alert("Order placed successfully!");
  loadPopupCart();
});

// --- Load Orders ---
async function loadUserOrders() {
  const user = auth.currentUser;
  if (!user) return;
  const ordersRef = collection(db, `orders/${user.email}/history`);
  const snapshot = await getDocs(ordersRef);
  const container = document.getElementById("ordersList");
  container.innerHTML = "";

  if (snapshot.empty) {
    container.innerHTML = "<p>No orders yet.</p>";
    return;
  }

  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    const div = document.createElement("div");
    div.className = "order-block";
    const itemsHTML = data.items.map(item => `<li>${item.name} x${item.quantity}</li>`).join("");
    div.innerHTML = `
      <strong>Total: ₹${data.total}</strong><br/>
      <small>${new Date(data.timestamp).toLocaleString()}</small>
      <ul>${itemsHTML}</ul>
    `;
    container.appendChild(div);
  });
}

// --- Auth State Change ---
onAuthStateChanged(auth, user => {
  if (user) {
    document.getElementById('authOverlay').style.display = 'none';
    console.log(`[AUTH] User logged in: ${user.email}`);
    loadMenu();
  } else {
    console.log("[AUTH] No user logged in");
    document.getElementById('authOverlay').style.display = 'flex';
  }
});
