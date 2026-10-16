# @oops/tracker

The script a site drops in to count page views with
[oops](https://oops.3m4.net). Zero dependencies, ES2019, under 3 KB
gzipped, no cookies, no localStorage. Built by `bun run build` into
`apps/web/public/m.js` (and `/m/v1.js`), which the web service serves.

```html
<script defer src="https://metrics.3m4.net/m.js" data-key="oops_pub_…"></script>
```

| Attribute | Default | Meaning |
|---|---|---|
| `data-key` | — | the project's public key (required) |
| `data-api` | script origin + `/api/collect` | collect endpoint, for self-hosted instances behind another host |
| `data-spa` | `true` | hook `pushState` / `replaceState` / `popstate` and send a page view per route change |
| `data-hash` | `false` | hash routing: keep the `#fragment` in the URL and listen to `hashchange` |
| `data-dnt` | `false` | honour the browser's Do Not Track signal |
| `data-local` | `false` | also track on `localhost`, raw IPs, `file:` and `*.local` |

JavaScript API, available once the script has loaded (queue calls before that
with `window.oops = { q: [["track", "signup", { plan: "pro" }]] }`):

```js
oops.track("signup", { plan: "pro" }); // custom event with ≤ 2 KB of props
oops.pageview();                         // manual page view (when data-spa="false")
```

Declarative events: `<button data-oops-event="cta_click" data-oops-props='{"where":"hero"}'>`.

```bash
bun install && bun test && bun run build
```
