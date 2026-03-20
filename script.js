/* === AUTH SCREEN VISUAL PATCH === */
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

  const originalUpdateLanguageUI = window.updateLanguageUI;
  if (typeof originalUpdateLanguageUI === 'function') {
    window.updateLanguageUI = function patchedUpdateLanguageUI() {
      originalUpdateLanguageUI();
      const rememberLabel = document.getElementById('remember-label');
      if (rememberLabel) {
        rememberLabel.textContent = currentLang === 'pl' ? 'Zapamiętaj mnie' : 'Remember me';
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
