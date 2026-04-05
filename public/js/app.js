// FoodBridge — app.js (PWA + auto-update)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/service-worker.js');
      // Check for new version on every page load
      reg.update().catch(() => {});

      // If a new SW installed and is waiting → it already called skipWaiting
      // so controllerchange fires → we reload automatically below
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        w.addEventListener('statechange', () => {
          if (w.state === 'installed' && navigator.serviceWorker.controller) {
            // Show banner so user knows update is happening
            showUpdateToast();
          }
        });
      });
    } catch(err) { /* SW unavailable, app still works */ }
  });

  // When SW activates (skipWaiting ran) → reload page to load new code
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!reloading) { reloading = true; window.location.reload(); }
  });
}

function showUpdateToast() {
  if (document.getElementById('fb-toast')) return;
  const el = document.createElement('div');
  el.id = 'fb-toast';
  el.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#1a4a2e;color:#fff;border-radius:14px;padding:12px 20px;font-family:DM Sans,sans-serif;font-size:.88rem;font-weight:600;box-shadow:0 8px 30px rgba(0,0,0,.3);z-index:9999;display:flex;align-items:center;gap:10px;max-width:90vw;animation:fbPop .3s ease;';
  el.innerHTML = '🔄 <span>Updating FoodBridge…</span>';
  document.body.appendChild(el);
  const s = document.createElement('style');
  s.textContent = '@keyframes fbPop{from{transform:translateX(-50%) scale(.8);opacity:0}to{transform:translateX(-50%) scale(1);opacity:1}}';
  document.head.appendChild(s);
  setTimeout(() => el.remove(), 5000);
}

// PWA install banner
let deferredInstall = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault(); deferredInstall = e;
  const isStandalone = window.matchMedia('(display-mode:standalone)').matches;
  if (!isStandalone && !sessionStorage.getItem('fbInstallDismissed')) {
    setTimeout(showInstallBanner, 5000);
  }
});

function showInstallBanner() {
  if (!deferredInstall || document.getElementById('fb-install')) return;
  const el = document.createElement('div');
  el.id = 'fb-install';
  el.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#fff;border:2px solid #1a4a2e;border-radius:16px;padding:14px 16px;font-family:DM Sans,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.15);z-index:9998;display:flex;align-items:center;gap:12px;max-width:90vw;width:360px;animation:fbPop .3s ease;';
  el.innerHTML = `
    <img src="/images/icon-192.png" style="width:42px;height:42px;border-radius:10px;flex-shrink:0;"/>
    <div style="flex:1;min-width:0;"><div style="font-weight:700;font-size:.9rem;color:#1a4a2e;">Install FoodBridge</div><div style="font-size:.75rem;color:#6b7280;">Add to home screen — works offline</div></div>
    <button id="fb-install-yes" style="background:#1a4a2e;color:#fff;border:none;border-radius:10px;padding:8px 14px;font-weight:700;font-size:.8rem;cursor:pointer;white-space:nowrap;">Install</button>
    <button id="fb-install-no" style="background:#f3f4f6;border:none;border-radius:8px;padding:8px 10px;font-size:.9rem;cursor:pointer;">✕</button>`;
  document.body.appendChild(el);
  document.getElementById('fb-install-yes').onclick = async () => {
    el.remove(); deferredInstall.prompt(); deferredInstall = null;
  };
  document.getElementById('fb-install-no').onclick = () => {
    el.remove(); sessionStorage.setItem('fbInstallDismissed','1');
  };
}

// Auto-dismiss alerts after 5s
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.alert').forEach(a => {
    setTimeout(() => { a.style.transition='opacity .5s'; a.style.opacity='0'; setTimeout(()=>a.remove(),500); }, 5000);
  });
});
