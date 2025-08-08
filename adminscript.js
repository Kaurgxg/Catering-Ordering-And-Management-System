import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  getDocs,
  addDoc,
  collectionGroup
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";


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

// ========== FUNCTIONS ==========

// Logging
async function logAction(action, details) {
  try {
    await addDoc(collection(db, "logs"), {
      timestamp: new Date(),
      action,
      details
    });
  } catch (err) {
    console.error("Logging failed:", err);
  }
}

// Load Admin Data
async function loadAdminData(user) {
  const adminRef = doc(db, "admins", user.uid);
  const snapshot = await getDoc(adminRef);
  let data;
  if (snapshot.exists()) {
    data = snapshot.data();
  } else {
    data = { name: "No Name", email: user.email };
    await setDoc(adminRef, data);
  }

  document.getElementById("dashboardLock").style.display = "none";
  document.getElementById("subtitle").innerText = "ADMIN";
  document.getElementById("loginForm").style.display = "none";
  document.getElementById("profileInfo").style.display = "block";
  document.getElementById("adminName").innerText = data.name;
  document.getElementById("adminEmailDisplay").innerText = data.email;

  const menuBtn = document.getElementById("menuBtn");
menuBtn.onclick = () => {
  closeOrders();
  closeUpload();
};

const logoutBtn = document.getElementById("logoutBtn");
logoutBtn.onclick = () => adminLogout();


  // Scroll into view on mobile
  if (window.innerWidth <= 768) {
    setTimeout(() => {
      document.querySelector(".dashboard-panel").scrollIntoView({ behavior: "smooth" });
    }, 200);
  }
}

// Login
async function adminLogin() {
  const email = document.getElementById("adminEmail").value.trim();
  const password = document.getElementById("adminPassword").value.trim();
  if (!email || !password) return alert("Fill in all fields");

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    await loadAdminData(userCredential.user);
    await logAction("Admin Login", { email });
  } catch (error) {
    alert("Login failed: " + error.message);
  }
}

// Signup
async function adminSignup() {
  const email = document.getElementById("adminEmail").value.trim();
  const password = document.getElementById("adminPassword").value.trim();
  if (!email || !password) return alert("Fill in all fields");

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const name = prompt("Enter your name:") || "No Name";
    await setDoc(doc(db, "admins", userCredential.user.uid), { name, email });
    await loadAdminData(userCredential.user);
    await logAction("Admin Signup", { email, name });
  } catch (error) {
    alert("Signup failed: " + error.message);
  }
}

// Edit Name
async function editName() {
  const newName = prompt("Enter new name:");
  if (!newName) return;

  const user = auth.currentUser;
  if (!user) return;

  try {
    const adminRef = doc(db, "admins", user.uid);
    await updateDoc(adminRef, { name: newName });
    document.getElementById("adminName").innerText = newName;
    await logAction("Edit Admin Name", { uid: user.uid, newName });
    alert("Name updated!");
  } catch (error) {
    alert("Failed to update name: " + error.message);
  }
}

// Logout
function adminLogout() {
  const email = auth.currentUser?.email || "Unknown";
  logAction("Admin Logout", { email });

  signOut(auth)
    .then(() => location.reload())
    .catch((err) => alert("Logout error: " + err.message));
}

// ✅ Expose it to the global scope
window.adminLogout = adminLogout;


// View Orders
async function viewOrders() {
  document.querySelector(".dashboard-icons").style.display = "none";
  document.querySelector(".dashboard-buttons").style.display = "none";
  document.getElementById("ordersView").style.display = "block";
  document.getElementById("uploadView").style.display = "none";

  await logAction("View Orders", { admin: auth.currentUser?.email || "Unknown" });

  const ordersContainer = document.getElementById("ordersContainer");
  ordersContainer.innerHTML = "<p>Loading orders...</p>";

  try {
    const querySnapshot = await getDocs(collectionGroup(db, "history"));
    if (querySnapshot.empty) {
      ordersContainer.innerHTML = "<p>No orders found.</p>";
      return;
    }

    let html = "";
    querySnapshot.forEach(doc => {
      const order = doc.data();
      const itemsList = order.items?.map(item =>
        `${item.name} (x${item.quantity}) - ₹${item.price}`).join("<br>") || "No items";
      html += `
        <div style="border: 2px solid #B0B990; margin-bottom: 10px; padding: 10px; font-size: 10px;">
          <strong>Order ID:</strong> ${doc.id}<br>
          <strong>Items:</strong><br> ${itemsList}<br>
          <strong>Total:</strong> ₹${order.total || 0}<br>
          <strong>Time:</strong> ${order.timestamp ? new Date(order.timestamp).toLocaleString() : "N/A"}
        </div>
      `;
    });
    ordersContainer.innerHTML = html;
  } catch (err) {
    ordersContainer.innerHTML = `<p>Error loading orders: ${err.message}</p>`;
  }
}

// Close Orders View
function closeOrders() {
  document.getElementById("ordersView").style.display = "none";
  document.querySelector(".dashboard-icons").style.display = "flex";
  document.querySelector(".dashboard-buttons").style.display = "flex";
}

// Upload Item View
function uploadItem() {
  document.querySelector(".dashboard-icons").style.display = "none";
  document.querySelector(".dashboard-buttons").style.display = "none";
  document.getElementById("ordersView").style.display = "none";
  document.getElementById("uploadView").style.display = "block";
}

// Close Upload View
function closeUpload() {
  document.getElementById("uploadView").style.display = "none";
  document.querySelector(".dashboard-icons").style.display = "flex";
  document.querySelector(".dashboard-buttons").style.display = "flex";
}

// Upload to Firestore
async function uploadItemToFirestore() {
  const name = document.getElementById("itemName").value.trim();
  const description = document.getElementById("itemDesc").value.trim();
  const price = parseFloat(document.getElementById("itemPrice").value.trim());

  if (!name || !description || isNaN(price)) {
    return alert("Please fill all fields correctly.");
  }

  try {
    await addDoc(collection(db, "menu"), {
      name,
      description,
      price,
      createdAt: new Date()
    });

    await logAction("Upload Item", { name, description, price });
    alert("Item uploaded successfully!");
    document.getElementById("itemName").value = "";
    document.getElementById("itemDesc").value = "";
    document.getElementById("itemPrice").value = "";
    closeUpload();
  } catch (err) {
    alert("Upload failed: " + err.message);
  }
}

// ========== AUTH STATE ==========
onAuthStateChanged(auth, (user) => {
  if (user) loadAdminData(user);
});

// ========== BIND TO WINDOW ==========
window.adminLogin = adminLogin;
window.adminSignup = adminSignup;
window.editName = editName;
window.adminLogout = adminLogout;
window.viewOrders = viewOrders;
window.closeOrders = closeOrders;
window.uploadItem = uploadItem;
window.closeUpload = closeUpload;
window.uploadItemToFirestore = uploadItemToFirestore;
