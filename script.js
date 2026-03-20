// === AUTH LOGIC ===

let currentLang = 'pl';
let authMode = 'login';

function t(key) {
  const texts = {
    pl: {
      login: 'Logowanie',
      register: 'Rejestracja',
      loginBtn: 'Zaloguj się',
      registerBtn: 'Zarejestruj się',
      passwordMismatch: 'Hasła się nie zgadzają',
      invalidLogin: 'Błędne dane',
      registered: 'Konto utworzone',
    },
    en: {
      login: 'Login',
      register: 'Register',
      loginBtn: 'Login',
      registerBtn: 'Register',
      passwordMismatch: 'Passwords do not match',
      invalidLogin: 'Wrong data',
      registered: 'Account created',
    }
  };
  return texts[currentLang][key] || key;
}

function setAuthMode(mode) {
  authMode = mode;

  document.getElementById('login-tab').classList.toggle('active', mode === 'login');
  document.getElementById('register-tab').classList.toggle('active', mode === 'register');

  document.getElementById('confirm-wrapper').classList.toggle('hidden', mode !== 'register');

  document.getElementById('auth-submit').textContent =
    mode === 'login' ? t('loginBtn') : t('registerBtn');
}

async function handleAuth(e) {
  e.preventDefault();

  const login = document.getElementById('auth-login').value.trim();
  const email = document.getElementById('auth-email')?.value.trim();
  const password = document.getElementById('auth-password').value;
  const confirm = document.getElementById('auth-confirm')?.value;

  const message = document.getElementById('auth-message');
  message.textContent = '';

  try {
    if (authMode === 'register') {
      if (password !== confirm) {
        message.textContent = t('passwordMismatch');
        return;
      }

      await fetch('/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login, email, password })
      });

      message.textContent = t('registered');
      setAuthMode('login');
      return;
    }

    const res = await fetch('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login, password })
    });

    const data = await res.json();

    if (!data.success) {
      message.textContent = t('invalidLogin');
      return;
    }

    alert("Zalogowano!");
    location.reload();

  } catch (err) {
    message.textContent = t('invalidLogin');
  }
}

// === EVENTS ===

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('auth-form').addEventListener('submit', handleAuth);
  document.getElementById('login-tab').addEventListener('click', () => setAuthMode('login'));
  document.getElementById('register-tab').addEventListener('click', () => setAuthMode('register'));

  setAuthMode('login');
});


// === AUTH SCREEN VISUAL PATCH ===

(function () {
  const originalSetAuthMode = window.setAuthMode;
  if (typeof originalSetAuthMode === 'function') {
    window.setAuthMode = function patchedSetAuthMode(mode) {
      originalSetAuthMode(mode);
      const authScreen = document.getElementById('auth-screen');
      if (authScreen) {
        authScreen.classList.toggle('auth-mode-login', mode === 'login');
        authScreen.classList.toggle('auth-mode-register', mode === 'register');
      }
      const remember = document.getElementById('remember-wrapper');
      if (remember) {
        remember.classList.toggle('hidden', mode !== 'login');
      }
    };
  }

  document.addEventListener('DOMContentLoaded', () => {
    const authScreen = document.getElementById('auth-screen');
    if (authScreen) {
      authScreen.classList.add('auth-mode-login');
      authScreen.classList.remove('auth-mode-register');
    }
  });
})();
