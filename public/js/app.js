// ══════════════════════════════════════════════════════════════════════════════
//  FoodBridge — Main App JS
//  Handles: PWA install, auto-update banner, notifications
// ══════════════════════════════════════════════════════════════════════════════

// ── Service Worker Registration + Auto-Update ─────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/service-worker.js');
      console.log('[App] SW registered:', reg.scope);

      // Check for update every time page loads
      reg.update();

      // A new service worker is waiting to activate (= new version deployed)
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        console.log('[App] New SW installing…');

        newWorker.addEventListener('statechange', () => {
          // New SW installed and waiting — there's already an old SW controlling the page
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('[App] New version ready — showing update banner');
            showUpdateBanner(reg);
          }
        });
      });

      // Page controlled by SW for first time (fresh install)
      if (!navigator.serviceWorker.controller) {
        console.log('[App] App installed and ready for offline use');
      }

    } catch (err) {
      console.warn('[App] SW registration failed:', err);
    }
  });

  // When SW activates after skipWaiting → reload the page to use new version
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      refreshing = true;
      console.log('[App] Controller changed — reloading for new version');
      window.location.reload();
    }
  });
}

// ── Update Banner ─────────────────────────────────────────────────────────────
function showUpdateBanner(reg) {
  // Remove any existing banner
  const existing = document.getElementById('update-banner');
  if (existing) existing.remove();

  const banner = document.createElement('div');
  banner.id = 'update-banner';
  banner.innerHTML = `
    <div style="
      position:fixed; bottom:20px; left:50%; transform:translateX(-50%);
      background:#1a4a2e; color:#fff; border-radius:16px;
      padding:14px 20px; box-shadow:0 8px 32px rgba(0,0,0,.3);
      display:flex; align-items:center; gap:14px;
      z-index:9999; font-family:'DM Sans',sans-serif;
      max-width:92vw; width:420px; animation:slideUp .4s ease;
    ">
      <span style="font-size:1.6rem; flex-shrink:0;">🔄</span>
      <div style="flex:1; min-width:0;">
        <div style="font-weight:700; font-size:.95rem;">Update Available!</div>
        <div style="font-size:.78rem; opacity:.8; margin-top:2px;">A new version of FoodBridge is ready</div>
      </div>
      <button id="update-now-btn" style="
        background:#22c55e; color:#fff; border:none; border-radius:10px;
        padding:9px 18px; font-weight:700; font-size:.85rem;
        cursor:pointer; font-family:'DM Sans',sans-serif; white-space:nowrap;
        transition:background .2s;
      ">Update Now</button>
      <button id="update-dismiss-btn" style="
        background:rgba(255,255,255,.15); color:#fff; border:none; border-radius:8px;
        padding:8px 12px; font-size:.82rem; cursor:pointer; font-family:'DM Sans',sans-serif;
        white-space:nowrap;
      ">Later</button>
    </div>
    <style>
      @keyframes slideUp { from { transform:translateX(-50%) translateY(80px); opacity:0; } to { transform:translateX(-50%) translateY(0); opacity:1; } }
    </style>
  `;

  document.body.appendChild(banner);

  // Update Now — tell SW to skip waiting, page reloads automatically
  document.getElementById('update-now-btn').addEventListener('click', () => {
    banner.remove();
    if (reg.waiting) {
      reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  });

  // Dismiss — hide banner, remind again next visit
  document.getElementById('update-dismiss-btn').addEventListener('click', () => {
    banner.style.animation = 'none';
    banner.style.opacity   = '0';
    banner.style.transition = 'opacity .3s';
    setTimeout(() => banner.remove(), 300);
  });

  // Auto-dismiss after 30 seconds
  setTimeout(() => {
    if (document.getElementById('update-banner')) {
      document.getElementById('update-banner').remove();
    }
  }, 30000);
}

// ── PWA Install Prompt ────────────────────────────────────────────────────────
let deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredInstallPrompt = e;

  // Only show install prompt if user hasn't installed yet
  const alreadyInstalled = window.matchMedia('(display-mode: standalone)').matches;
  if (!alreadyInstalled && !localStorage.getItem('installDismissed')) {
    setTimeout(() => showInstallBanner(), 3000); // show after 3s
  }
});

function showInstallBanner() {
  if (!deferredInstallPrompt) return;
  if (document.getElementById('install-banner')) return;

  const banner = document.createElement('div');
  banner.id = 'install-banner';
  banner.innerHTML = `
    <div style="
      position:fixed; bottom:20px; left:50%; transform:translateX(-50%);
      background:#fff; border:2px solid #1a4a2e; border-radius:16px;
      padding:14px 20px; box-shadow:0 8px 32px rgba(0,0,0,.15);
      display:flex; align-items:center; gap:14px;
      z-index:9998; font-family:'DM Sans',sans-serif;
      max-width:92vw; width:420px; animation:slideUp .4s ease;
    ">
      <span style="font-size:1.8rem; flex-shrink:0;">🌿</span>
      <div style="flex:1; min-width:0;">
        <div style="font-weight:700; font-size:.95rem; color:#1a4a2e;">Install FoodBridge</div>
        <div style="font-size:.78rem; color:#6b7280; margin-top:2px;">Add to home screen for quick access</div>
      </div>
      <button id="install-now-btn" style="
        background:#1a4a2e; color:#fff; border:none; border-radius:10px;
        padding:9px 18px; font-weight:700; font-size:.85rem;
        cursor:pointer; font-family:'DM Sans',sans-serif; white-space:nowrap;
      ">Install</button>
      <button id="install-dismiss-btn" style="
        background:#f3f4f6; color:#374151; border:none; border-radius:8px;
        padding:8px 12px; font-size:.82rem; cursor:pointer; font-family:'DM Sans',sans-serif;
      ">✕</button>
    </div>
  `;
  document.body.appendChild(banner);

  document.getElementById('install-now-btn').addEventListener('click', async () => {
    banner.remove();
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    if (outcome === 'accepted') console.log('[App] PWA installed by user');
    deferredInstallPrompt = null;
  });

  document.getElementById('install-dismiss-btn').addEventListener('click', () => {
    banner.remove();
    localStorage.setItem('installDismissed', '1');
  });
}

// ── Auto-dismiss alerts ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.alert').forEach(alert => {
    setTimeout(() => {
      alert.style.transition = 'opacity .5s';
      alert.style.opacity    = '0';
      setTimeout(() => alert.remove(), 500);
    }, 5000);
  });
});
