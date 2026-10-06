(function () {
  'use strict';

  /* ---------- Langue ---------- */
  const SUPPORTED = ['fr', 'en', 'ar'];
  function detectDefaultLang() {
    const saved = localStorage.getItem('nep_lang');
    if (saved && SUPPORTED.includes(saved)) return saved;
    const nav = (navigator.language || 'fr').slice(0, 2).toLowerCase();
    return SUPPORTED.includes(nav) ? nav : 'fr';
  }

  function applyLang(lang) {
    const dict = TRANSLATIONS[lang] || TRANSLATIONS.fr;
    document.documentElement.lang = lang;
    document.documentElement.dir = dict.dir;

    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (dict[key] !== undefined) el.textContent = dict[key];
    });

    document.querySelectorAll('[data-i18n-attr]').forEach((el) => {
      const [attr, key] = el.getAttribute('data-i18n-attr').split(':');
      if (dict[key] !== undefined) el.setAttribute(attr, dict[key]);
    });

    const tEl = document.querySelector('title');
    const tKey = (tEl && tEl.getAttribute('data-i18n')) || 'meta_title';
    document.title = dict[tKey] || dict.meta_title;

    document.querySelectorAll('.lang-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.lang === lang);
    });

    const cur = document.getElementById('langCurrent');
    if (cur) cur.textContent = lang.toUpperCase();
    localStorage.setItem('nep_lang', lang);
    window.__nepLang = lang;
  }

  document.querySelectorAll('.lang-btn').forEach((btn) => {
    btn.addEventListener('click', () => applyLang(btn.dataset.lang));
  });

  /* ---------- Liste déroulante des langues ---------- */
  const langToggle = document.getElementById('langToggle');
  const langMenu = document.getElementById('langMenu');
  function setLangMenu(open) {
    if (!langMenu) return;
    langMenu.hidden = !open;
    langToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  if (langToggle && langMenu) {
    langToggle.addEventListener('click', (e) => { e.stopPropagation(); setLangMenu(langMenu.hidden); });
    langMenu.addEventListener('click', () => setLangMenu(false));
    document.addEventListener('click', () => setLangMenu(false));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setLangMenu(false); });
  }

  applyLang(detectDefaultLang());

  /* ---------- Retour en haut de page (lien "Accueil") ---------- */
  // On gère ce cas en JS plutôt qu'en simple ancre, car l'en-tête est "sticky"
  // (collant) : le navigateur peut mal calculer la position de défilement
  // vers une ancre posée directement sur un élément sticky.
  document.querySelectorAll('a[href="#top"]').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      history.replaceState(null, '', window.location.pathname);
    });
  });

  /* ---------- Menu mobile ---------- */
  const navToggle = document.getElementById('navToggle');
  const mainNav = document.getElementById('mainNav');
  if (navToggle && mainNav) {
    navToggle.addEventListener('click', () => {
      const open = mainNav.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    mainNav.querySelectorAll('a').forEach((a) =>
      a.addEventListener('click', () => {
        mainNav.classList.remove('open');
        navToggle.setAttribute('aria-expanded', 'false');
      })
    );
  }

  /* ---------- Année du footer ---------- */
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- Formulaire de contact ---------- */
  const form = document.getElementById('contactForm');
  const statusEl = document.getElementById('formStatus');
  const submitBtn = document.getElementById('submitBtn');
  let formLoadTime = Date.now();

  // Arrivée depuis une page service : pré-remplit l'objet du message
  const wanted = new URLSearchParams(location.search).get('service');
  if (form && /^s[1-6]$/.test(wanted || '') && form.subject && !form.subject.value) {
    form.subject.value = (TRANSLATIONS[window.__nepLang] || TRANSLATIONS.fr)[wanted + '_title'].slice(0, 160);
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const dict = TRANSLATIONS[window.__nepLang] || TRANSLATIONS.fr;

      // Anti-spam simple : un vrai humain met plus de 2s à remplir le formulaire
      if (Date.now() - formLoadTime < 2000) {
        return;
      }

      if (!form.checkValidity()) {
        statusEl.textContent = dict.form_error_validation;
        statusEl.className = 'form-status err';
        form.reportValidity();
        return;
      }

      const payload = {
        name: form.name.value.trim(),
        email: form.email.value.trim(),
        phone: form.phone.value.trim(),
        subject: form.subject.value.trim(),
        message: form.message.value.trim(),
        lang: window.__nepLang || 'fr',
        website: form.website.value, // honeypot
      };

      submitBtn.disabled = true;
      statusEl.textContent = dict.form_sending;
      statusEl.className = 'form-status';

      try {
        const res = await fetch('/api/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!res.ok) throw new Error('request_failed');

        statusEl.textContent = dict.form_success;
        statusEl.className = 'form-status ok';
        form.reset();
        formLoadTime = Date.now();
      } catch (err) {
        statusEl.textContent = dict.form_error;
        statusEl.className = 'form-status err';
      } finally {
        submitBtn.disabled = false;
      }
    });
  }
})();
