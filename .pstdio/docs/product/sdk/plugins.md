# Extensions

The project-local plugin system has been removed. Prompt Studio no longer loads TypeScript or JavaScript modules from `.pstdio/plugins`, and the SDK no longer exports `@pstdio/sdk/plugins`.

Use extensions for new automation. Extensions can provide:

- commands
- command middleware
- lifecycle event handlers
- menu contributions
- webviews

## Authoring Types

Import extension contracts from `@pstdio/sdk/extensions`:

```ts
import type { ExtensionDefinition } from "@pstdio/sdk/extensions";

const extension: ExtensionDefinition = {
  manifest: {
    id: "example-extension",
    name: "Example extension",
    version: "0.0.0",
  },
  activate(ctx) {
    ctx.commands.register({
      id: "example-extension.say-hello",
      title: "Say hello",
      handler: () => ({ ok: true }),
    });
  },
};

export default extension;
```

## Lifecycle Automation

Use command middleware for blocking behavior. Use event handlers for post-state-change automation.

The first-party default automation is shipped as extensions:

- `pstdio-core-ticket-automations`
- `pstdio-core-workspace-automations`
- `pstdio-core-worktree-automation`
