// Live examples (see _ext/trebol_live.py): each frame takes the documentation's
// light or dark, follows it when the reader switches, and grows with its app.
(() => {
  const os = matchMedia('(prefers-color-scheme: dark)');
  const scheme = () => {
    const chosen = document.body.dataset.theme;
    return chosen === 'light' || chosen === 'dark' ? chosen : os.matches ? 'dark' : 'light';
  };
  // a live page calls this from its <head>, so its first paint is already right
  window.trebolLiveScheme = root => { root.dataset.tbScheme = scheme(); };
  const frames = () => Array.from(document.querySelectorAll('iframe.trebol-live'));
  const repaint = () => {
    for (const f of frames()) if (f.contentDocument) window.trebolLiveScheme(f.contentDocument.documentElement);
  };
  const fit = f => {
    const doc = f.contentDocument;
    if (!doc || !doc.body) return;
    // in case the frame was parsed before this script ran
    window.trebolLiveScheme(doc.documentElement);
    // the body, not the document: a document is never shorter than its frame
    new ResizeObserver(() => { f.style.height = `${Math.ceil(doc.body.getBoundingClientRect().height)}px`; }).observe(doc.body);
  };
  for (const f of frames()) {
    f.addEventListener('load', () => fit(f));
    if (f.contentDocument?.readyState === 'complete' && f.contentWindow.location.href !== 'about:blank') fit(f);
  }
  new MutationObserver(repaint).observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });
  os.addEventListener('change', repaint);
})();
