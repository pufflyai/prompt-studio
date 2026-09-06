# @pstdio/sdk

The public TypeScript SDK for Prompt Studio. It provides extension contracts, the HTTP client, and prompt helpers. The package is ESM-only; import a declared subpath.

```sh
bun add @pstdio/sdk
```

| Entry point | Purpose |
| --- | --- |
| `@pstdio/sdk/extensions` | Contributions, typed refs, commands, storage contracts, and webview clients |
| `@pstdio/sdk/extensions/react` | React query and mutation hooks for webviews |
| `@pstdio/sdk/client` | HTTP client |
| `@pstdio/sdk/api` | API request and response types |
| `@pstdio/sdk/resources` | Product resource types |
| `@pstdio/sdk/prompts` | Prompt rendering |
| `@pstdio/sdk/hooks` | Hook API contracts |

Native extension entries work without React. The React entry requires its declared React and TanStack Query peers. Public declarations include their private contract dependencies and support `skipLibCheck: false` outside the repository.

## Build an extension

Start with the [workbench cookbook](https://github.com/pufflyai/prompt-studio/blob/main/.pstdio/docs/extensions/cookbook.md) and [Extension Lab](https://github.com/pufflyai/prompt-studio/blob/main/extensions/extension-lab/README.md). Existing examples cover saved edits, inspectors, shared panels, custom modes, provider refs, and webview cleanup.

Keep package identity in `package.json`. Export `defineExtension(...)` from the manifest's `main`. Install through `pst extensions dev <path>` from a linked project. The same workflow watches native TypeScript, contribution declarations, and webview assets.

A view supplies content. A page owns its route, routed resource, and page panels. A mode supplies shared panels and chrome. Use `ResourceRef` with `type`, `id`, and optional `label` across these contracts. Main, Side, and Secondary are the panel regions.

A page declares `resource: { kinds }` separately from `main`. Main can show a view or a collection of peer panels with an empty view. Additional slots expose generated refs such as `page.panels.inspector`. Slots and mode placements share the same static-view or resource-binding item union.

Page targets change location. Panel targets preserve it. Compound targets contain only page and panel steps, prepared before one commit. Commands and external links remain standalone actions. Omitted mode chrome retains host navigation for custom modes too.

Use `qualifyRef(owner, ref)` in provider contract modules. Keep definitions local and pass qualified refs between extensions. For webviews, declare capabilities and call the typed `GuestHost`; `placement.close` closes the calling placement through the normal tab controller.

## Package delivery

Development and installed consumers both load built SDK entries. Repository development builds this package before starting the source CLI. Builds stage release files under `.publish` through the shared release script. Package verification installs those same staged artifacts into a temporary directory outside the monorepo and checks every entry point.

Host authors should use the [workbench guide](https://github.com/pufflyai/prompt-studio/blob/main/packages/pstdio-workbench/README.md). Extension authors should use this SDK and public UI packages.
