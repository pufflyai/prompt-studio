# Contextual workbench composition

The visible workbench is the union of shell, active mode, and active page placements. Owners own placements, not regions.

- A view owns one reusable UI body.
- A mode placement owns content that remains while the mode stays active.
- A page owns one primary slot and any auxiliary slots for one routed screen.
- A resource binding connects a resource kind to a view inside a page slot or mode placement.

Mode and page placements may share `main`, `secondary`, or `side`. Leaving a page removes its placements and keeps the mode placements. Leaving a mode removes both that mode and its active page.

Placement identity includes owner kind, owner contribution id, slot or placement id, and resource instance key. Region, label, registration time, and current tab are not identity.

Each region sorts placements by declared `order`, qualified owner id, and instance key. The workbench reconciles the complete desired owner set in one transition. It never clears a region because one owner contributes to it.

The Sidenav is one composed TreeRenderer. Mode navigation sections appear before page sections. Header and footer stay pinned while content scrolls. User tree customization may reorder or hide rows, but the Sidenav movement policy prevents a row from crossing mode and page ownership.
