# Anchor context menus in their viewport

A context menu must open at the pointer position in the document that owns its portal. A controlled open state does not supply that position.

## Failure

The Planner timeline created a Chakra menu after a right click and passed `anchorPoint` to `Menu.Root`. The menu opened at the iframe's top left. Zag owns its context-menu anchor as internal state; that prop did not set the anchor for the controlled menu.

## Fix

For a menu created from stored pointer coordinates, pass a zero-sized rectangle through `positioning.getAnchorRect` and use `strategy: "fixed"`. Use the event's `clientX` and `clientY`. Keep the portal in the same document. Let the positioning library shift or flip the menu near viewport edges.

For a persistent trigger, use the shared `ResourceContextMenu` or Chakra's `Menu.ContextTrigger`. Those controls own the pointer and keyboard context-menu events.

Do not use page, screen, or canvas coordinates as a viewport anchor. Panning and zooming change canvas coordinates, while a context menu still uses the pointer's viewport position.

## Validation

Right click away from the top left, then repeat after horizontal panning and zooming. Check the menu rectangle against the click position. Repeat near a viewport edge and inside an extension iframe. Select an action and confirm that it receives the intended track and milestone.

The corrected implementation is [Planner's background menu](../../extensions/pstdio-planner/src/timeline/view/background-menu.tsx). Its [Storybook examples](../../extensions/pstdio-planner/src/timeline/view/background-menu.stories.tsx) keep the positioning case visible.
