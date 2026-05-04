---
"pstdio": patch
"@pstdio/sdk": patch
---

Tighten the `@pstdio/sdk/extensions` surface: `ParamDescriptor` is now a discriminated union (per-type fields like `options`, `templateType`, `resourceType` only appear where valid), `CommandDefinition` is parameterized by its `params` schema so `ctx.params` is inferred without casts, and a new `commandsOf(extension)` derives typed `CommandRef`s from the extension definition. Added `defineCommand` / `defineMiddleware` / `defineHook` builders, an `apiVersion: "1"` field on `ExtensionDefinition`, capability-mixin interfaces (`UiContributions`, `BehaviourContributions`, …), and JSDoc on the public surface. `MiddlewareDefinition`, `HookDefinition`, and `ScheduleContribution` now split typed refs (`command`/`event`) from untyped string ids (`commandId`/`eventId`) so the typed path can't silently degrade.
