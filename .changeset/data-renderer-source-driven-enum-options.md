---
"@pstdio/ui": minor
"pstdio": patch
---

Allow `enum` / `enum-multi` `AttributeDescriptor`s to declare their options as a reactive source (`{ subscribe, getSnapshot }` à la `useSyncExternalStore`) instead of a static array, and extend `DataRendererContribution.attributes` to accept an `AttributesSource` so an entire schema (which attributes exist, their kinds, and their options) can mutate at runtime without re-registering the renderer. `DataRenderer`, `DataRendererToolbar`, and `WorkbenchDataView` subscribe through the new `useResolvedAttributes` hook so live additions/removals/edits propagate immediately. Adds `EnumOptions`, `EnumOptionsSource`, `isEnumOptionsSource`, `getEnumOptions`, `AttributesSource`, `isAttributesSource`, `resolveAttributeOptions`, and `useResolvedAttributes` to the public API; existing static descriptors continue to work unchanged. Also: enum group columns now honor the descriptor's declared option order instead of sorting alphabetically; the dashboard workspace renderer draws its status options from the live `attempt_statuses` collection so newly added/edited statuses propagate without reloading the workbench.
