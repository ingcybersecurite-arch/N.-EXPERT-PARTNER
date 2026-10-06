(function () {
  'use strict';

  const isLoginPage = document.body.classList.contains('login-body');

  /* ---------------- Login page ---------------- */
  if (isLoginPage) {
    // Si déjà connecté, redirige direct vers le dashboard
    fetch('/api/admin/me').then((r) => r.json()).then((d) => {
      if (d.isAdmin) window.location.href = '/admin/dashboard.html';
    });

    const form = document.getElementById('loginForm');
    const statusEl = document.getElementById('loginStatus');
    const btn = document.getElementById('loginBtn');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      btn.disabled = true;
      statusEl.textContent = '';

      try {
        const res = await fetch('/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: form.username.value.trim(),
            password: form.password.value,
          }),
        });
        const data = await res.json();

        if (!res.ok) {
          statusEl.textContent = data.error || 'Connexion impossible.';
          btn.disabled = false;
          return;
        }

        window.location.href = '/admin/dashboard.html';
      } catch (err) {
        statusEl.textContent = 'Erreur réseau. Réessayez.';
        btn.disabled = false;
      }
    });

    return;
  }

  /* ---------------- Dashboard page ---------------- */
  const listEl = document.getElementById('messagesList');
  const emptyEl = document.getElementById('emptyState');
  const totalEl = document.getElementById('totalCount');
  const unreadEl = document.getElementById('unreadCount');
  const whoamiEl = document.getElementById('whoami');
  const logoutBtn = document.getElementById('logoutBtn');
  const refreshBtn = document.getElementById('refreshBtn');

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  function formatDate(iso) {
    try {
      const d = new Date(iso);
      return d.toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
    } catch (e) {
      return iso;
    }
  }

  function renderMessages(messages) {
    listEl.innerHTML = '';
    if (!messages.length) {
      emptyEl.hidden = false;
      listEl.hidden = true;
      return;
    }
    emptyEl.hidden = true;
    listEl.hidden = false;

    const unread = messages.filter((m) => !m.is_read).length;
    totalEl.textContent = `${messages.length} message(s)`;
    unreadEl.textContent = `${unread} non lu(s)`;

    messages.forEach((m) => {
      const card = document.createElement('article');
      card.className = 'message-card' + (m.is_read ? '' : ' unread');
      card.innerHTML = `
        <div class="message-top">
          <span class="message-name">${escapeHtml(m.name)} <span class="lang-tag">${escapeHtml((m.lang || 'fr').toUpperCase())}</span></span>
          <span class="message-date">${formatDate(m.created_at)}</span>
        </div>
        <div class="message-contacts">
          <a href="mailto:${escapeHtml(m.email)}">${escapeHtml(m.email)}</a>
          ${m.phone ? `<a href="tel:${escapeHtml(m.phone)}">${escapeHtml(m.phone)}</a>` : ''}
        </div>
        ${m.subject ? `<div class="message-subject">${escapeHtml(m.subject)}</div>` : ''}
        <div class="message-body">${escapeHtml(m.message)}</div>
        <div class="message-actions">
          ${!m.is_read ? `<button class="btn btn-outline-dark btn-sm" data-action="read" data-id="${m.id}">Marquer comme lu</button>` : ''}
          <button class="btn btn-outline-dark btn-sm" data-action="delete" data-id="${m.id}">Supprimer</button>
        </div>
      `;
      listEl.appendChild(card);
    });
  }

  async function loadMessages() {
    const res = await fetch('/api/admin/messages');
    if (res.status === 401) {
      window.location.href = '/admin/login.html';
      return;
    }
    const data = await res.json();
    renderMessages(data.messages || []);
  }

  listEl.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    const action = btn.dataset.action;

    if (action === 'read') {
      await fetch(`/api/admin/messages/${id}/read`, { method: 'PATCH' });
      loadMessages();
    } else if (action === 'delete') {
      if (!confirm('Supprimer définitivement ce message ?')) return;
      await fetch(`/api/admin/messages/${id}`, { method: 'DELETE' });
      loadMessages();
    }
  });

  refreshBtn.addEventListener('click', loadMessages);

  logoutBtn.addEventListener('click', async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    window.location.href = '/admin/login.html';
  });

  (async function init() {
    const meRes = await fetch('/api/admin/me');
    const me = await meRes.json();
    if (!me.isAdmin) {
      window.location.href = '/admin/login.html';
      return;
    }
    whoamiEl.textContent = 'Connecté';
    loadMessages();
    // Rafraîchissement automatique toutes les 30s pour voir les nouveaux messages
    setInterval(loadMessages, 30000);
  })();
})();
