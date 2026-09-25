# Temporary landing page Bun runtime pin

This is a temporary workaround, not the intended design.

The landing page should build in production the same way it builds in CI and in its Dockerfile: Astro running on Node, with the repository's Bun version (1.4.2) installing dependencies.

Production builds on DigitalOcean App Platform with the Bun buildpack. That image has no Node, so Bun runs Astro in place of the `#!/usr/bin/env node` shebang. Under the Bun 1.4.2 runtime, Astro's prerender step fails with `defineTokens is not defined`, reported from a `@phosphor-icons/react` SSR module. The same build passes on Node 24 and on the Bun 1.3.14 runtime. Running `bun --bun run --cwd clients/landing-page build` on a clean checkout of `main` reproduces it.

A clean fix needs either Node in the build image or a Bun runtime that prerenders the site. The Bun buildpack offers no way to add Node, and the Node.js buildpack runs its own npm install, which conflicts with the Bun lockfile.

As a temporary workaround, the App Platform spec pins `BUN_VERSION` to 1.3.14 for the `ps-landing` static site. The workaround lives only in that spec; the repository, CI, and the Dockerfile stay on Bun 1.4.2. The trade-off is that production installs and builds with an older Bun than the rest of the project. Bun 1.3.14 reads the current lockfile and installs it with `--frozen-lockfile`, so dependency versions still match.

The same spec change also fixed the underlying outage, and that part is permanent. The build command now runs `rm -rf node_modules && bun install --frozen-lockfile --ignore-scripts --filter @pstdio/landing-page` before building. The buildpack had been restoring a cached root `node_modules` and skipping the install, and that cache lacks workspace binaries such as `chakra`. Every production deploy failed from September 17 to September 25, 2026 for this reason.

Remove the pin when `bun --bun run --cwd clients/landing-page build` passes on a clean checkout with the repository's Bun version. Then set `BUN_VERSION` in the App Platform spec to that version and confirm a production deploy reaches `ACTIVE`.
