# Anchor context menus in their viewport

## 1. When to use

- Positioning a context menu in a scrolled, zoomed, or iframe-hosted view.

## 2. Failure

- A dynamically created Chakra menu opened at the iframe's top left. Controlled open state and an `anchorPoint` prop did not set Zag's internal context-menu anchor.

## 3. Prevention

- For stored pointer coordinates, use `positioning.getAnchorRect` with a zero-sized rectangle and `strategy: "fixed"`.
- Use the event's `clientX` and `clientY`; keep the portal in that document.
- Let the positioning library shift or flip the menu near viewport edges.
- For persistent triggers, use `ResourceContextMenu` or `Menu.ContextTrigger` so pointer and keyboard events share an owner.
- Check positioning against the click in the affected viewport; panning and zooming must not change the coordinate system.

## 4. Evidence

- [Planner background menu](../../extensions/pstdio-planner/src/timeline/view/background-menu.tsx)
- [Canvas examples](../../extensions/pstdio-planner/src/timeline/view/background-menu.canvas.tsx)
