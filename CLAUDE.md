# oops — notes for agents

- Spec: `CONTRACT.md` (API, objects, scopes, collect / tracker / stats semantics). Keep it in sync with the code.
- Sibling projects and reference implementations: `/home/enrique/retro` (user feedback; oops was bootstrapped from it), `/home/enrique/exp` (feature flags) and `/home/enrique/3m4` (URL shortener, whose click enrichment this reuses). Same stack, same chrome. When in doubt, do what retro does.
- Everything in this repo (code, comments, commits, docs) is written in English.
- Local stack: `make up` → http://localhost:8084 (8080 belongs to 3m4, 8081 to exp, 8082 to retro). Compose project name `oops`.
- Build mode: Claude writes the whole codebase unless Enrique says "modo aprender".
- Visual PRs carry a demo GIF + webm in the description (`docs/pr/`).
- Brand colour: Tailwind **fuchsia** (3m4 blue, exp violet, retro emerald, bubbles orange).
- Never store raw user agents; raw IPs only behind the per-project `store_ip` switch (Enrique asked for IPs on 2026-10-15), hashes + derived fields otherwise.
- e2e and smoke hits must send a real browser UA: headless / tool UAs are filtered as bots on purpose.
