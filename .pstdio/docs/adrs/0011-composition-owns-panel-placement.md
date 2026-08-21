# ADR: Composition Owns Panel Placement

## Status

Accepted.

## Context

Panel placement depends on the active mode, active resource, and saved layout. The composition resolver reads all three and resolves the current region, role, required state, and Add Panel options.

Widget registration held a second answer. It stored a role, closability, and a panel's supported regions before the active context was known. Extension panels therefore registered as generic content even when composition later placed them as locations or sub-panels. UI callers had to merge registration checks with resolver output. Missing one input made a valid closed panel impossible to add again.

A value that changes with the destination is a placement fact. It is not panel identity.

## Decision

The composition resolver is the only owner of panel placement.

- `workbench.composition.panelsFor(region)` returns the open, addable, and closable panels for the current context.
- Widget registrations do not store a role. Each placement stores its resolved role.
- Panel contributions do not declare `supportedRegions` or registration-time closability. Their `show` field declares default placement for resource kinds or modes owned by the extension. Required resolved placements are not closable; optional resolved placements are closable and can be added again.
- `resourcePanels` binds a panel only into a resource slot owned by another extension.
- A mode recipe describes differences from the panel's declared placement. It may move a panel only within that placement's `allowedRegions`.
- An impossible placement reports `extension_panel_placement_unresolvable`.

## Consequences

- UI callers have one query and cannot forget a second eligibility list.
- Closable and addable state come from the same resolved placement.
- An extension declares its own resource panel body and placement together.
- The manifest contract is breaking. The extension API version moves to `1.0.0-alpha.2`, and all bundled extensions move with it.
- Cross-extension composition stays explicit through resource slots.
- Persisted layout does not change. Placement roles were already stored there.

## Rejected Alternatives

- Keeping registration and composition answers would preserve the source of the bug and require every caller to merge them.
- Copying resolved values onto registrations would become stale when the mode or resource changes.
- Treating every closable panel as a sub-panel would expose panels in unrelated contexts and confuse identity with placement.
