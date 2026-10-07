(() => {
  'use strict';

  // Zen10: AI変換はGitHub送信時だけ許可する。
  // v10本体のローカルかな化・typo補正はそのまま動かし、
  // 入力停止やSpaceをきっかけにしたGemini通信だけを遮断する。
  if (/\/v10\/?$/.test(location.pathname)) {
    const originalFetch = window.fetch.bind(window);
    let sendAiAllowed = false;

    document.addEventListener('keydown', event => {
      if (event.isComposing) return;
      if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
        sendAiAllowed = true;
      }
    }, true);

    window.fetch = (input, init) => {
      const url = typeof input === 'string' ? input : (input?.url || '');
      const isGemini = url.includes('generativelanguage.googleapis.com/');
      const isGithubContents = url.includes('api.github.com/repos/') && url.includes('/contents/');

      if (isGemini && !sendAiAllowed) {
        return Promise.reject(new Error('Zen10: live AI conversion is disabled'));
      }

      // 送信直前のGemini変換が終わり、GitHub保存へ進んだ時点で閉じる。
      if (isGithubContents) sendAiAllowed = false;

      return originalFetch(input, init);
    };
  }

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