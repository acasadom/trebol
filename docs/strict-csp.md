# A strict Content-Security-Policy

Many organisations put their web apps behind a **Content-Security-Policy** (CSP): a header the web server
sends with every page, telling the browser where code and styles may come from. Public bodies, banks and
anyone audited for security often require one. A strict policy looks like this:

```text
Content-Security-Policy: default-src 'self'; img-src 'self' data: blob:
```

`'self'` means "files from this same server". With it the browser runs no script and applies no style that
is written inside the page or made up by a script; only files served from the site. It is a second wall
against an attacker who manages to slip text into the page: whatever they slip in does not run.

Trebol works under such a policy. This page says what to set up and why.

## What Trebol does to fit

- **No styles written into the page.** The theme and the Inter font are given to the browser as constructed
  style sheets, which a policy allows; Trebol makes no `<style>` element and writes no `style` attribute.
  What it sets while the app runs, such as a height or a position, goes through the element's own style
  object, which a policy allows too. The browser's inspector shows that as a `style` on the element; it is
  not one written into the page, and no policy blocks it.
- **No HTML from text.** Every text, from the app or from a server, is put on the page as text, never read as
  HTML, so there is nothing for an attacker to inject. A `link` whose address comes from the data opens only
  web, mail and phone addresses; a `javascript:` address goes nowhere.
- **No code from text.** Trebol runs no JavaScript made from a string.

## Putting the app on such a server

`trebol build` writes one page with everything inside, so it opens even from the disk. A strict policy blocks
exactly that, the runtime and the fonts written inside the page. Build it with `--csp` instead:

```sh
npx trebol build --csp
```

`build/index.html` then loads Trebol from `build/trebol.js`, and the fonts from `build/fonts/` (all of them:
the browser downloads only those its text needs). The app's `.trb` files stay inside the page, as data, which
a policy does not block. Copy the `build` folder to the server as usual. Such a page needs a web server: it no
longer opens from the disk with a double click.

The other way to publish, your own `index.html` loading Trebol from a CDN, works too if the policy lets the
CDN's scripts and fonts in:

```text
Content-Security-Policy: default-src 'self'; script-src 'self' https://cdn.jsdelivr.net;
  font-src 'self' https://cdn.jsdelivr.net; img-src 'self' data: blob:
```

The `img-src` part of both is for two small things Trebol shows: the preview of a photo being uploaded
(`blob:`) and an arrow icon drawn in the theme (`data:`). The app's calls to its server (`fetch`,
WebSocket, server-sent events) fall under `connect-src`, which `default-src 'self'` already covers when the
server is the same one.

## A face in JavaScript

A [face written in JavaScript](ui/03-layout.md) is your own code, so the policy applies to it as written. Give
its styles as a constructed style sheet, not a `<style>` in an `innerHTML`, as the `<star-rating>` example
does:

```text
const sheet = new CSSStyleSheet();
sheet.replaceSync(`:host { display: inline-flex; } button { color: var(--tb-primary); }`);
// in the constructor
this.attachShadow({ mode: 'open' }).adoptedStyleSheets = [sheet];
```

## Trying it

`trebol dev` sends no policy, so an app that works there may still trip one. Serve the output of
`trebol build --csp` from a server that sends the header and open the browser's console: every blocked script
or style shows there as a message that names the policy it broke.
