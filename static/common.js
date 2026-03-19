(function () {
  const root = document.documentElement;

  function isRegularNavigationClick(event, anchor) {
    if (event.defaultPrevented) return false;
    if (event.button !== 0) return false;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
    if (anchor.target && anchor.target.toLowerCase() !== '_self') return false;

    const href = anchor.getAttribute('href') || '';
    if (!href || href.startsWith('#') || href.startsWith('javascript:')) return false;

    return true;
  }

  document.addEventListener(
    'click',
    (event) => {
      const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (!anchor) return;
      if (!isRegularNavigationClick(event, anchor)) return;
      root.classList.add('is-link-loading');
    },
    true,
  );

  window.addEventListener('pageshow', () => {
    root.classList.remove('is-link-loading');
  });
})();
