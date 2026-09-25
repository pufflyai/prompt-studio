# Extension runtime smoke checks

Run `pst extensions test ./my-extension` to install a local source into a disposable home and load its resource-free pages in the real dashboard. Provision the matching Chromium browser once with `bunx playwright@1.60.0 install chromium --with-deps`.

Use `--json` for one machine-readable result on stdout. Logs go to stderr. Use `--keep-home` to retain the temporary run directory and evidence after all processes stop. `--project-path <directory>` supplies fixture context containing the source and its relative local dependencies. Original source files, caller project configuration, lockfiles and installed dependencies are never changed. Dependencies install in the copied context. Source symlinks and absolute local dependencies are unsupported.

The result includes installed source identity and hash, host and browser versions, phase durations, individual checks, visited contributions, and coverage omissions. Exit 0 means the applicable initial-load checks passed; 1 means an extension runtime failure; 2 means an installation or declaration failure; 3 means input or setup failure. Dependent checks prevented by a failure are marked `not-run`.

A pass covers registration, selected resource-free page compositions, mounted webview readiness, and errors observed during those steps. Commands, resource-bound editors, settings, optional tabs and interaction-only branches require explicit tests. Duplicate display labels are allowed. Zero UI visits are valid for extensions without eligible pages. The command never creates domain resources or executes arbitrary commands.

Chromium support follows Playwright 1.60.0: macOS arm64/x64, Windows x64, and supported Linux x64/arm64 distributions. Browser support loads only for this command. See [ADR 0029](../adrs/0029-temporary-chromium-only-playwright-bundle.md) for the temporary compiled-bundle exclusion of optional BiDi modules.

For repository validation, build dashboard assets first, run `bun run validate`, then `bun run --cwd scripts verify:packages`. Packaged consumer fixtures exercise passing views, startup exceptions and capability denials caught by guest code. For interactive dashboard validation use `bun run dev:playwright` and stop it with `bun run dev:playwright:down`.
