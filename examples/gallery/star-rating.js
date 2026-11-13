// <star-rating>: from one to five stars, with the mouse or the arrow keys.
// Its colors are the theme's, which reach it as --tb-* custom properties.

class StarRating extends HTMLElement {
  #value = null;
  #stars = [];

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>
      :host { display: inline-flex; gap: 2px; }
      button { font: inherit; font-size: 1.75rem; line-height: 1; padding: 2px; border: 0; border-radius: var(--tb-radius);
               background: none; color: var(--tb-border-strong); cursor: pointer; }
      button.on { color: var(--tb-primary); }
      button:focus-visible { outline: 2px solid var(--tb-focus); outline-offset: 1px; }
    </style>`;
    for (let n = 1; n <= 5; n++) {
      const star = document.createElement('button');
      star.type = 'button';
      star.textContent = '★';
      star.setAttribute('aria-label', `${n} of 5`);
      star.addEventListener('click', () => this.#choose(n));
      star.addEventListener('keydown', e => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') this.#choose(Math.min(5, n + 1), true);
        if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') this.#choose(Math.max(1, n - 1), true);
      });
      this.#stars.push(star);
      root.append(star);
    }
    this.#paint();
  }

  get value() { return this.#value; }
  set value(v) { this.#value = typeof v === 'number' ? v : null; this.#paint(); }

  #choose(n, focus = false) {
    this.value = n;
    if (focus) this.#stars[n - 1].focus();
    this.dispatchEvent(new Event('change'));
    if (n === 5) this.dispatchEvent(new CustomEvent('delight', { detail: 'five stars' }));
  }

  #paint() {
    this.#stars.forEach((s, i) => {
      s.classList.toggle('on', this.#value !== null && i < this.#value);
      s.setAttribute('aria-pressed', String(this.#value === i + 1));
    });
  }
}

customElements.define('star-rating', StarRating);
