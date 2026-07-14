(function(){
  const ua = navigator.userAgent || '';
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const state = {
    installed: !!isStandalone,
    platform: detectPlatform(),
    deferredPrompt: null,
    online: navigator.onLine !== false,
  };
  window.__aw139PwaState = state;

  const hadController = !!(navigator.serviceWorker && navigator.serviceWorker.controller);
  const launchMask = createLaunchMask();
  const networkChip = createNetworkChip();
  let lastScrollState = false;

  function detectPlatform(){
    if (/iPad|iPhone|iPod/.test(ua)) return 'ios';
    if (/Android/.test(ua)) return 'android';
    return 'other';
  }

  function pagePath(){
    return location.pathname.replace(/\\+/g, '/');
  }

  function layoutHref(){
    const path = pagePath();
    if (path.includes('/cata/') || path.includes('/adc/') || path.includes('/wat/') || path.includes('/rto/')) {
      return '../shared/module-layout.css';
    }
    return null;
  }

  function activeModuleClass(){
    const path = pagePath();
    if (path.includes('/wat/')) return 'module-shell-wat';
    if (path.includes('/rto/')) return 'module-shell-rto';
    if (path.includes('/adc/')) return 'module-shell-adc';
    if (path.includes('/cata/')) return 'module-shell-cata';
    return '';
  }

  function ensureModuleLayoutStyles(){
    const href = layoutHref();
    if (!href || document.getElementById('aw139ModuleLayoutStyles')) return;
    const link = document.createElement('link');
    link.id = 'aw139ModuleLayoutStyles';
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }

  function updateViewportClasses(){
    if (!document.body) return;
    const vv = window.visualViewport;
    const width = Math.round((vv && vv.width) || window.innerWidth || document.documentElement.clientWidth || 0);
    const height = Math.round((vv && vv.height) || window.innerHeight || document.documentElement.clientHeight || 0);
    const isPortrait = height >= width;
    const deviceClass = width < 768 ? 'aw-device-phone' : width <= 1366 ? 'aw-device-tablet' : 'aw-device-desktop';
    document.body.classList.remove(
      'aw-device-phone','aw-device-tablet','aw-device-desktop',
      'aw-orientation-portrait','aw-orientation-landscape',
      'module-shell-wat','module-shell-rto','module-shell-adc','module-shell-cata'
    );
    document.body.classList.add(deviceClass, isPortrait ? 'aw-orientation-portrait' : 'aw-orientation-landscape');
    const moduleClass = activeModuleClass();
    if (moduleClass) document.body.classList.add(moduleClass);
    document.body.dataset.awDevice = deviceClass.replace('aw-device-','');
    document.body.dataset.awOrientation = isPortrait ? 'portrait' : 'landscape';
  }

  function serviceWorkerConfig(){
    const path = pagePath();
    if (path.includes('/wat/')) return { url: 'sw.js', scope: './' };
    if (path.includes('/rto/')) return { url: 'sw.js', scope: './' };
    if (path.includes('/importar-voo/')) return { url: 'sw.js', scope: './' };
    if (path.includes('/ncl/')) return { url: 'service-worker.js', scope: './' };
    // Módulos sem service worker próprio ficam sob o SW da raiz.
    if (path.includes('/cata/') || path.includes('/adc/') || path.includes('/pouso-offshore/') || path.includes('/decolagem-offshore/') || path.includes('/dropdown/')) return { url: '../sw.js', scope: '../' };
    return { url: 'sw.js', scope: './' };
  }

  function setShellReady(){
    if (!document.body) return;
    document.body.classList.add('pwa-shell-ready');
  }

  function updateScrollState(){
    const y = window.scrollY || document.documentElement.scrollTop || 0;
    const scrolled = y > 8;
    if (!document.body || scrolled === lastScrollState) return;
    lastScrollState = scrolled;
    document.body.classList.toggle('is-scrolled', scrolled);
  }

  async function register(){
    if (!('serviceWorker' in navigator)) return;
    const cfg = serviceWorkerConfig();
    try {
      const reg = await navigator.serviceWorker.register(cfg.url, { scope: cfg.scope });
      if (reg.waiting) notifyUpdate(reg);
      reg.addEventListener('updatefound', () => {
        const worker = reg.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) notifyUpdate(reg);
        });
      });
    } catch (err) {
      console.warn('SW registration failed', err);
    }
  }

  function ensureBar(){
    let bar = document.getElementById('pwaToast');
    if (bar) return bar;
    bar = document.createElement('div');
    bar.id = 'pwaToast';
    bar.hidden = true;
    bar.innerHTML = '<div class="pwa-toast-text"></div><button type="button" class="pwa-toast-action" hidden></button><button type="button" class="pwa-toast-close" aria-label="Fechar">×</button>';
    Object.assign(bar.style, {position:'fixed',left:'12px',right:'12px',bottom:'max(12px, env(safe-area-inset-bottom))',zIndex:'9999',display:'flex',gap:'10px',alignItems:'center',padding:'12px 14px',borderRadius:'16px',background:'rgba(15,23,42,.94)',color:'#e5eef7',border:'1px solid rgba(255,255,255,.12)',boxShadow:'0 18px 40px rgba(0,0,0,.28)',backdropFilter:'blur(12px)'});
    const actionStyle = {borderRadius:'12px',border:'1px solid rgba(70,194,186,.45)',background:'linear-gradient(180deg,#2fa7a0,#248d87)',color:'#08131a',fontWeight:'800',minHeight:'40px',padding:'0 14px',cursor:'pointer'};
    Object.assign(bar.querySelector('.pwa-toast-action').style, actionStyle);
    Object.assign(bar.querySelector('.pwa-toast-close').style, {marginLeft:'auto',border:'0',background:'transparent',color:'#a9b8c8',fontSize:'22px',cursor:'pointer'});
    bar.querySelector('.pwa-toast-close').onclick = () => { bar.hidden = true; };
    document.body.appendChild(bar);
    return bar;
  }

  function notifyUpdate(reg){
    const bar = ensureBar();
    bar.querySelector('.pwa-toast-text').textContent = 'Nova versão disponível para o app.';
    const btn = bar.querySelector('.pwa-toast-action');
    btn.hidden = false;
    btn.textContent = 'Atualizar';
    btn.onclick = () => { reg.waiting && reg.waiting.postMessage({ type: 'SKIP_WAITING' }); };
    bar.hidden = false;
  }

  function installGuideHtml(){
    if (state.platform === 'ios') {
      return '<strong>Instalar no iPhone/iPad</strong><br>Abra no Safari, toque em <em>Compartilhar</em> e depois em <em>Adicionar à Tela de Início</em>.';
    }
    if (state.platform === 'android') {
      return '<strong>Instalar no Android</strong><br>Toque em <em>Instalar app</em> quando o navegador oferecer ou use o menu do navegador.';
    }
    return '<strong>Instalar como app</strong><br>Use a opção de instalar/adicionar à tela inicial no navegador compatível.';
  }

  function createLaunchMask(){
    const mask = document.createElement('div');
    mask.className = 'pwa-launch-mask';
    mask.innerHTML = '<div class="pwa-launch-card"><div class="pwa-launch-icon"><img src="'+launchIconPath()+'" alt=""></div><div class="pwa-launch-title">AW139 Companion</div><div class="pwa-launch-subtitle">Carregando ambiente operacional…</div></div>';
    document.addEventListener('DOMContentLoaded', () => {
      document.body.appendChild(mask);
    }, { once: true });
    return mask;
  }

  function launchIconPath(){
    const path = pagePath();
    if (path.includes('/pesos/')) return 'icon.png';
    if (path.includes('/slo/')) return 'assets/icon-192.png';
    if (path.includes('/ncl/')) return 'assets/icon-192.svg';
    if (path.includes('/cata/') || path.includes('/adc/') || path.includes('/wat/') || path.includes('/rto/') || path.includes('/pouso-offshore/') || path.includes('/decolagem-offshore/') || path.includes('/dropdown/') || path.includes('/importar-voo/')) return '../assets/icon-192.png';
    return 'assets/icon-192.png';
  }

  function hideLaunchMask(){
    if (!launchMask || !launchMask.parentNode) {
      setShellReady();
      return;
    }
    launchMask.classList.add('is-hiding');
    window.setTimeout(() => {
      if (launchMask.parentNode) launchMask.parentNode.removeChild(launchMask);
      setShellReady();
    }, 260);
  }

  function createNetworkChip(){
    const chip = document.createElement('div');
    chip.className = 'pwa-network-chip';
    chip.hidden = true;
    chip.textContent = 'Online';
    document.addEventListener('DOMContentLoaded', () => {
      document.body.appendChild(chip);
      updateNetworkChip();
    }, { once: true });
    return chip;
  }

  function updateNetworkChip(){
    if (!networkChip) return;
    state.online = navigator.onLine !== false;
    if (state.online) {
      networkChip.hidden = true;
      networkChip.classList.remove('offline');
      networkChip.textContent = 'Online';
    } else {
      networkChip.hidden = false;
      networkChip.classList.add('offline');
      networkChip.textContent = 'Modo offline';
    }
    updateInstallStatusText();
  }

  function updateInstallStatusText(){
    const installStatus = document.getElementById('installStatusText');
    if (!installStatus) return;
    if (state.installed) {
      installStatus.textContent = state.online ? 'App instalado e pronto para abrir em tela cheia.' : 'App instalado em modo offline. Home, Cat A, WAT, RTO e ADC ficam disponíveis após a sincronização inicial online desta versão.';
      return;
    }
    if (state.platform === 'ios') {
      installStatus.textContent = 'Instale pela Safari para abrir em tela cheia, com aparência de app e acesso rápido aos módulos.';
      return;
    }
    installStatus.textContent = state.deferredPrompt ? 'Este navegador já permite instalar o app direto da tela inicial.' : 'Instale pelo navegador para abrir em tela cheia, com aparência de app e acesso rápido aos módulos.';
  }

  function basePrefix(){
    const path = pagePath();
    if (path.includes('/cata/') || path.includes('/adc/') || path.includes('/wat/') || path.includes('/rto/') || path.includes('/dropdown/') || path.includes('/pouso-offshore/') || path.includes('/decolagem-offshore/') || path.includes('/pesos/') || path.includes('/slo/') || path.includes('/ncl/') || path.includes('/importar-voo/')) return '../';
    return './';
  }

  function renderGlobalBottomNav(){
    if (!document.body) return;
    if (!document.getElementById('aw139GlobalTabBarStyles')) {
      const style = document.createElement('style');
      style.id = 'aw139GlobalTabBarStyles';
      style.textContent = '.app-tab-bar{position:fixed;left:max(12px, env(safe-area-inset-left));right:max(12px, env(safe-area-inset-right));bottom:max(12px, env(safe-area-inset-bottom));z-index:9998;background:rgba(15,23,42,.94);border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:8px;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:4px;box-shadow:0 18px 40px rgba(0,0,0,.28);backdrop-filter:blur(12px)}.tab-item{display:grid;justify-items:center;gap:2px;padding:6px 2px;border-radius:12px;color:#bfd1e3;text-decoration:none;min-width:0}.tab-item.active{background:rgba(47,167,160,.22);color:#e9fbfa}.tab-icon{font-size:18px;line-height:1}.tab-label{font-size:10px;font-weight:700;text-align:center;line-height:1.15}body{padding-bottom:max(92px, calc(80px + env(safe-area-inset-bottom)))}';
      document.head.appendChild(style);
    }
    const prefix = basePrefix();
    const items = [
      { key: 'home', icon: '🏠', label: 'Home', href: prefix + 'index.html' },
      { key: 'pesos', icon: '🗺️', label: 'Voo', href: prefix + 'pesos/?embed=1&back=1&return=../index.html' },
      { key: 'cata', icon: '📋', label: 'Cat A', href: prefix + 'cata/' },
      { key: 'pouso-offshore', icon: '🛬', label: 'Pouso Offshore', href: prefix + 'pouso-offshore/' },
      { key: 'decolagem-offshore', icon: '🚁', label: 'Decolagem Offshore', href: prefix + 'decolagem-offshore/' }
    ];
    const path = pagePath();
    const currentKey = path.endsWith('/index.html') || path === '/' ? 'home'
      : path.includes('/pesos/') ? 'pesos'
      : path.includes('/cata/') ? 'cata'
      : path.includes('/pouso-offshore/') ? 'pouso-offshore'
      : path.includes('/decolagem-offshore/') ? 'decolagem-offshore'
      : '';
    let nav = document.querySelector('.app-tab-bar');
    if (!nav) {
      nav = document.createElement('nav');
      nav.className = 'app-tab-bar';
      nav.setAttribute('aria-label', 'Navegação rápida');
      document.body.appendChild(nav);
    }
    nav.innerHTML = items.map((item) => {
      const active = item.key === currentKey ? ' active' : '';
      const aria = item.key === currentKey ? ' aria-current="page"' : '';
      return '<a href="' + item.href + '" class="tab-item' + active + '"' + aria + '><span class="tab-icon">' + item.icon + '</span><span class="tab-label">' + item.label + '</span></a>';
    }).join('');
  }

  function wireInstallButton(){
    const btn = document.getElementById('installGuideBtn');
    if (!btn) return;
    btn.addEventListener('click', async () => {
      if (state.deferredPrompt) {
        state.deferredPrompt.prompt();
        try { await state.deferredPrompt.userChoice; } catch (_) {}
        state.deferredPrompt = null;
        updateInstallStatusText();
        return;
      }
      showAw139InstallGuide();
    });
  }

  function showCacheUpdatedBanner(){
    const bar = ensureBar();
    bar.querySelector('.pwa-toast-text').textContent = 'App atualizado! Abra cada módulo online uma vez para garantir o uso offline.';
    const btn = bar.querySelector('.pwa-toast-action');
    btn.hidden = true;
    btn.onclick = null;
    bar.hidden = false;
  }

  function showOnlineToast(message){
    const bar = ensureBar();
    const btn = bar.querySelector('.pwa-toast-action');
    btn.hidden = true;
    btn.onclick = null;
    bar.querySelector('.pwa-toast-text').textContent = message;
    bar.hidden = false;
    window.clearTimeout(showOnlineToast._timer);
    showOnlineToast._timer = window.setTimeout(() => {
      if (bar && !bar.querySelector('.pwa-toast-action').hidden) return;
      bar.hidden = true;
    }, 2600);
  }

  window.showAw139InstallGuide = function(){
    const bar = ensureBar();
    bar.querySelector('.pwa-toast-text').innerHTML = installGuideHtml();
    const btn = bar.querySelector('.pwa-toast-action');
    btn.hidden = true;
    btn.onclick = null;
    bar.hidden = false;
  };

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    state.deferredPrompt = event;
    updateInstallStatusText();
  });

  window.addEventListener('appinstalled', () => {
    state.installed = true;
    state.deferredPrompt = null;
    document.documentElement.classList.add('is-standalone');
    document.body && document.body.classList.add('is-standalone');
    updateInstallStatusText();
    showOnlineToast('App instalado com sucesso.');
  });

  window.addEventListener('online', () => {
    updateNetworkChip();
    showOnlineToast('Conexão restabelecida.');
  });
  window.addEventListener('offline', () => {
    updateNetworkChip();
    showOnlineToast('Modo offline ativo.');
  });

  window.addEventListener('load', () => {
    register();
    hideLaunchMask();
    updateNetworkChip();
    updateScrollState();
    updateViewportClasses();
  });

  window.addEventListener('pageshow', () => {
    ensureModuleLayoutStyles();
    setShellReady();
    updateScrollState();
    updateViewportClasses();
  });

  window.addEventListener('scroll', updateScrollState, { passive: true });
  window.addEventListener('resize', () => {
    updateScrollState();
    updateViewportClasses();
  }, { passive: true });

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', updateViewportClasses, { passive: true });
  }

  window.addEventListener('DOMContentLoaded', () => {
    ensureModuleLayoutStyles();
    document.documentElement.classList.toggle('is-standalone', state.installed);
    document.body.classList.toggle('is-standalone', state.installed);
    updateInstallStatusText();
    wireInstallButton();
    if (localStorage.getItem('aw139_sw_updated')) {
      localStorage.removeItem('aw139_sw_updated');
      window.setTimeout(showCacheUpdatedBanner, 800);
    }
    renderGlobalBottomNav();
    updateViewportClasses();
    window.dispatchEvent(new CustomEvent('aw139-pwa-state', { detail: state }));
  });

  if (navigator.serviceWorker) {
    // Recarrega SÓ quando um SW novo substitui um antigo (atualização real).
    // Na primeira instalação (claim sem controller anterior) recarregar
    // derrubava a página no meio do uso — uma das causas do app "travar".
    let reloadedForUpdate = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || reloadedForUpdate) return;
      reloadedForUpdate = true;
      localStorage.setItem('aw139_sw_updated', '1');
      window.location.reload();
    });
  }
})();
