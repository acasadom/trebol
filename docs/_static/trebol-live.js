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
  // a page opened as a file cannot run them: say how to see them instead of showing an empty frame
  if (location.protocol === 'file:') {
    for (const f of frames()) {
      const note = document.createElement('p');
      note.className = 'trebol-live-file';
      note.textContent = 'This example runs live when the documentation is served, not opened as a file. '
        + 'In the trebol folder run: npm run docs:serve, then open http://localhost:8000/';
      f.parentElement.replaceWith(note);
    }
    return;
  }
  const repaint = () => {
    for (const f of frames()) if (f.contentDocument) window.trebolLiveScheme(f.contentDocument.documentElement);
  };
  const fit = f => {
    const doc = f.contentDocument;
    if (!doc || !doc.body) return;
    // in case the frame was parsed before this script ran
    window.trebolLiveScheme(doc.documentElement);
    // the body, not the document: a document is never shorter than its frame; an open dialog is in the
    // top layer, outside the body, so the frame also grows to hold it
    const size = () => {
      let h = doc.body.getBoundingClientRect().height;
      for (const d of doc.querySelectorAll('dialog[open]')) h = Math.max(h, d.scrollHeight + 96);
      f.style.height = `${Math.ceil(h)}px`;
    };
    const watch = new ResizeObserver(size);
    watch.observe(doc.body);
    new MutationObserver(() => {
      for (const d of doc.querySelectorAll('dialog')) watch.observe(d);
      size();
    }).observe(doc.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['open'] });
  };
  for (const f of frames()) {
    f.addEventListener('load', () => fit(f));
    if (f.contentDocument?.readyState === 'complete' && f.contentWindow.location.href !== 'about:blank') fit(f);
  }
  new MutationObserver(repaint).observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });
  os.addEventListener('change', repaint);
})();
