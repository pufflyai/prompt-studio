# Temporary scroll area geometry isolation

Proposed: 2026-10-10

Status: Accepted

## Intended design

Scroll geometry belongs to the viewport and scrollbars. Updating it should not recalculate styles for every message in a transcript. Content must retain normal scrolling, sticky positioning, and nested scroll areas.

## External limitation

The installed Chakra ScrollArea uses Zag 1.35.3. Zag writes thumb and corner CSS variables on its root, and overflow-distance variables on its viewport. These custom properties inherit into content. Resize and scroll updates repeatedly invalidate transcript styles, even though messages do not use those values. The API has no option to scope these variables to their consumers.

The packaged streaming check passes script usage on Windows but spends 99.3% of wall time in renderer tasks against a 90% budget. A local replay at threefold CPU throttling reproduces the failure. Its profile attributes substantial work to scrollbar updates, with 789 style recalculations during the measured interval.

## Decision

Temporarily reset the eight inherited geometry properties at the content slot through the shared ScrollArea theme recipe. Scrollbars remain siblings of the viewport and retain their root geometry. The viewport retains its overflow values, including values used for edge effects. A nested ScrollArea sets its own geometry at its own root.

This keeps the workaround in one shared recipe without changing the dependency, copying its state machine, or changing performance budgets.

## Limitations

Content descendants cannot consume an ancestor ScrollArea's private geometry variables. The repository has no such consumers. Viewport effects and the scrollbars still receive their values. Test both scroll directions, thumb dragging, sticky messages, and nested scroll areas when changing this recipe.

## Removal

Remove these resets when Chakra/Zag scopes geometry to its consumers or provides non-inheriting properties. Run the packaged streaming check with the same replay speed and CPU budgets, and validate scrollbar interactions before removing this workaround.
