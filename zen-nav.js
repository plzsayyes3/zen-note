(() => {
  'use strict';

  function mount() {
    if (document.querySelector('[data-zen-home-nav]')) return;

    const link = document.createElement('a');
    link.href = '../';
    link.dataset.zenHomeNav = 'true';
    link.setAttribute('aria-label', 'ZENトップへ戻る');
    link.title = 'ZENトップ';
    link.textContent = '⌂';

    Object.assign(link.style, {
      position: 'fixed',
      zIndex: '2147483646',
      left: 'max(5px, env(safe-area-inset-left))',
      top: 'max(5px, env(safe-area-inset-top))',
      width: '26px',
      height: '26px',
      display: 'grid',
      placeItems: 'center',
      border: '1px solid currentColor',
      borderRadius: '999px',
      background: 'rgba(127,127,127,.08)',
      color: 'inherit',
      font: '600 12px/1 ui-monospace, SFMono-Regular, Menlo, monospace',
      textDecoration: 'none',
      opacity: '.24',
      WebkitBackdropFilter: 'blur(8px)',
      backdropFilter: 'blur(8px)',
      transition: 'opacity .14s, background .14s',
      touchAction: 'manipulation'
    });

    const active = () => {
      link.style.opacity = '.9';
      link.style.background = 'rgba(127,127,127,.15)';
    };
    const quiet = () => {
      link.style.opacity = '.24';
      link.style.background = 'rgba(127,127,127,.08)';
    };

    link.addEventListener('pointerenter', active);
    link.addEventListener('pointerleave', quiet);
    link.addEventListener('focus', active);
    link.addEventListener('blur', quiet);

    document.body.appendChild(link);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})();