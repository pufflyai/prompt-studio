---
layout: ../../../../layouts/docs-layout.astro
title: pstdio (global commands)
description: Reference for pstdio, pstdio serve, and pstdio close.
htmlTitle: pstdio CLI reference
htmlDescription: "Reference for the top-level pstdio commands: pstdio, pstdio serve, and pstdio close."
section: References
category: CLI
categoryOrder: 1
order: 1
---

## pstdio

Starts the API (if not running), starts the dashboard, and opens it in the browser.

```bash
pstdio
```

**Options:**

- `--api-port <number>` — override the API port. Default `19840`.
- `--dashboard-port <number>` — override the dashboard port. Default `5555`.
- `--no-open-browser` — don't open a browser tab when the dashboard is ready.

## pstdio serve

Starts the API server and dashboard in a single foreground process.

```bash
pstdio serve --port 19840
```

**Options:**

- `--port <number>` — server port. Default `19840`.

## pstdio close

Stops the background API process by calling `POST /shutdown`.

```bash
pstdio close
```

No options.

## Related pages

- [Running the local API](/docs/operations/ports-and-env/).
