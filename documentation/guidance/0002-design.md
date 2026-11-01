# Design rules

## 1. Scope

1. Apply these rules to the app and its extensions.
2. Change these rules only at a human's request.

## 2. Design workflow

1. Keep appearance and component states in [Canvas](../../extensions/canvas/README.md).
2. Follow Planner's Canvas policy for UI changes. Update the design first when enabled, then make the implementation match it.
3. Record why Canvas was skipped when disabled or unavailable.

## 3. Styling rules

1. Use `@pstdio/ui` components. Use Chakra directly only when no shared component fits.
2. Use shared recipes and theme tokens for styles and motion.
3. Add missing styles to the shared theme instead of overriding them locally.
4. Do not use custom CSS, styled wrappers, inline design styles, or hardcoded visual values.
5. Use `ScrollArea` for scrollable surfaces.

## 4. Navigation and tabs

1. Pages with their own navigation replace the project tree.
2. Single-resource views have no tabs or close action. Multi-resource views keep both.
3. Keep tabs in one scrollable row and preserve their order.

## 5. Feedback

1. Show action failures beside the relevant control or content.
2. Show system errors in the status bar and chat errors in the conversation.
3. Never use toast notifications for errors.
4. Keep recovery and dismissal controls visible.

## 6. Interaction

1. Show progress during work and keep elapsed time after completion.
2. Never shimmer or pulse status text.
3. Make hover feedback immediate and delay explanatory tooltips.
4. Keep destructive actions visually distinct from close and dismiss actions.

## 7. Interface text

1. Cut taglines, unnecessary helper text, and secondary labels. If the UI needs them to make sense, fix the design.
2. Shorten long names in the middle, preserving their beginning and ending.
