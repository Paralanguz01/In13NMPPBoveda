// === Firebase Config ===
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Configuración Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBKIOXyAtbm2OZqhkrSr3yZEll2LLraLXc",
  authDomain: "bovedanmpp.firebaseapp.com",
  projectId: "bovedanmpp",
  storageBucket: "bovedanmpp.firebasestorage.app",
  messagingSenderId: "444064319814",
  appId: "1:444064319814:web:869308a7b2ce74e1163d47",
  measurementId: "G-8NKKHRFR1K"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// === UI Utils ===
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(name).classList.add('active');
}

function showModal(message, callback) {
  const modal = document.createElement('div');
  modal.id = 'custom-modal';
  modal.innerHTML = `
    <div class="modal-content">
      <span class="close-modal">❌</span>
      <p>${message}</p>
    </div>
  `;
  document.body.appendChild(modal);
  document.querySelector('.close-modal').addEventListener('click', () => {
    modal.remove();
    if (callback) callback();
  });
}

document.querySelectorAll('.toggle-password').forEach(toggle => {
  toggle.addEventListener('click', () => {
    const input = toggle.previousElementSibling;
    input.type = input.type === 'password' ? 'text' : 'password';
    toggle.textContent = input.type === 'password' ? '👁️' : '🙈';
  });
});

document.getElementById('go-register')?.addEventListener('click', () => showScreen('register-screen'));
document.getElementById('go-login')?.addEventListener('click', () => showScreen('login-screen'));

// === Validación de contraseña segura ===
const isValidPassword = (pw) => /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,}$/.test(pw);

// === Registro ===
document.getElementById('register-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = e.target.email.value;
  const password = e.target.password.value;

  if (!isValidPassword(password)) {
    alert("Contraseña inválida. Usa mínimo una mayúscula, minúscula y un número.");
    return;
  }

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, "users", cred.user.uid), {
      createdAt: serverTimestamp(),
      delayMinutes: 60,
      questions: [],
      reminder: "",
      vaultData: "",
      lastAccess: null
    });
    alert("Cuenta creada. Ahora inicia sesión.");
    showScreen('login-screen');
  } catch (err) {
    alert("Error de registro: " + err.message);
  }
});

// === Login ===
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = e.target.email.value;
  const password = e.target.password.value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    alert("Login fallido: " + err.message);
  }
});

// === Recuperar contraseña ===
document.getElementById('go-reset').addEventListener('click', () => {
  const email = prompt("Ingresa tu correo para recuperar tu contraseña:");
  if (email) {
    sendPasswordResetEmail(auth, email)
      .then(() => alert("Enlace de recuperación enviado."))
      .catch(err => alert("Error: " + err.message));
  }
});

// === Sesión activa ===
onAuthStateChanged(auth, async user => {
  if (user) {
    const snap = await getDoc(doc(db, "users", user.uid));
    const data = snap.data();

    if (!data.questions || data.questions.length === 0) {
      showScreen('config-screen');
    } else {
      initVault(data);
    }
  } else {
    showScreen('login-screen');
  }
});

// === Configuración inicial con modal ===
document.getElementById('config-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const reminder = e.target.reminder.value.trim();
  const q1 = e.target.q1.value.trim();
  const a1 = e.target.a1.value.trim();
  const q2 = e.target.q2.value.trim();
  const a2 = e.target.a2.value.trim();
  const delay = parseInt(e.target.delay.value);
  const unit = e.target.unit.value;

  if (!reminder || !q1 || !a1 || !q2 || !a2 || isNaN(delay)) {
    showModal("Por favor completa todos los campos.");
    return;
  }

  try {
    const delayMinutes = convertToMinutes(delay, unit);
    const questions = [
      { q: q1, a: a1.toLowerCase().trim() },
      { q: q2, a: a2.toLowerCase().trim() }
    ];

    const uid = auth.currentUser.uid;
    await updateDoc(doc(db, "users", uid), {
      reminder,
      questions,
      delayMinutes
    });

    showModal("✅ Configuración guardada exitosamente.", () => {
      initVault({ reminder, questions, delayMinutes, lastAccess: null, vaultData: "" });
    });
  } catch (err) {
    showModal("❌ Error al guardar configuración: " + err.message);
  }
});

function convertToMinutes(value, unit) {
  switch (unit) {
    case 'hours': return value * 60;
    case 'days': return value * 1440;
    default: return value;
  }
}

// === Iniciar flujo bóveda ===
async function initVault(userData) {
  const lastAccess = userData.lastAccess?.toDate?.() ?? null;
  const delayMs = (userData.delayMinutes ?? 60) * 60000;
  const now = new Date();
  const canAccess = !lastAccess || now - lastAccess > delayMs;

  if (canAccess) {
    showScreen('questions-screen');
    loadQuestions(userData);
  } else {
    startCountdownScreen(now - lastAccess, delayMs);
  }
}

function loadQuestions(userData) {
  const container = document.getElementById('questions-form');
  container.innerHTML = '';
  document.getElementById('reminder-msg').textContent = userData.reminder;

  userData.questions.forEach((item) => {
    const input = document.createElement('input');
    input.placeholder = item.q;
    input.dataset.answer = item.a.toLowerCase().trim();
    container.appendChild(input);
  });
}

// === Verificar respuestas ===
document.getElementById('submit-answers').addEventListener('click', async () => {
  const inputs = document.querySelectorAll('#questions-form input');
  const allCorrect = [...inputs].every(i => i.value.toLowerCase().trim() === i.dataset.answer);

  if (!allCorrect) {
    alert("Alguna respuesta es incorrecta.");
    return;
  }

  const uid = auth.currentUser.uid;
  await updateDoc(doc(db, "users", uid), { lastAccess: serverTimestamp() });
  loadVault();
});

// === Mostrar bóveda ===
async function loadVault() {
  const uid = auth.currentUser.uid;
  const snap = await getDoc(doc(db, "users", uid));
  const data = snap.data();

  document.getElementById('vault-data').value = data.vaultData || "";
  showScreen('vault-screen');
}

// === Guardar contenido ===
document.getElementById('save-vault').addEventListener('click', async () => {
  const data = document.getElementById('vault-data').value;
  const uid = auth.currentUser.uid;
  await updateDoc(doc(db, "users", uid), { vaultData: data });
  alert("Contenido guardado.");
});

// === Cerrar sesión ===
document.getElementById('close-vault').addEventListener('click', async () => {
  await signOut(auth);
  showScreen('login-screen');
});

// === Temporizador ===
function startCountdownScreen(timePassed, delayMs) {
  showScreen('countdown-screen');
  const el = document.getElementById('countdown');
  let msLeft = delayMs - timePassed;

  const interval = setInterval(() => {
    if (msLeft <= 0) {
      clearInterval(interval);
      location.reload();
      return;
    }
    const h = Math.floor(msLeft / 3600000);
    const m = Math.floor((msLeft % 3600000) / 60000);
    const s = Math.floor((msLeft % 60000) / 1000);
    el.textContent = `${h}h ${m}m ${s}s`;
    msLeft -= 1000;
  }, 1000);
}

// === Estilos del modal ===
const style = document.createElement('style');
style.innerHTML = `
  #custom-modal {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.7);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 9999;
  }
  .modal-content {
    background: #1f2a38;
    color: white;
    padding: 2rem;
    border-radius: 12px;
    position: relative;
    max-width: 400px;
    text-align: center;
  }
  .close-modal {
    position: absolute;
    top: 8px;
    right: 12px;
    cursor: pointer;
    font-size: 1.2rem;
  }
`;
document.head.appendChild(style);