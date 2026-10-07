# Changelog

## 0.2.2

- Keep ordinary arrows below cards and raise the selected hierarchy, with its cards above the highlighted arrows.
- Simplify gates to free-form instructions and launch a planning review on creation; show a distinct GATE card and retry failed launches safely.
- Add published artifact nodes with small sandboxed previews, direct opening, and links from existing tickets.
- Remove the empty milestone drop instruction and preview both the destination track and milestone with a subtle theme accent.
- Restore the panel header with Planner filters, filter chips, Display, and ticket search.
- Pan collapsed tracks out of the frame and reclaim their space for milestone headers; keep only the date gutter pinned.

- Zoom with the mouse wheel or trackpad scroll, keeping the canvas point under the pointer in place.

- Zoom the timeline canvas from 25% to its original 100% size with minus, plus, and percentage-reset controls.

- Show ticket IDs on timeline cards without numbered step prefixes.

- Pan the canvas by dragging empty space, hide scrollbars, and support arrow-key navigation.
- Pin collapsed track columns beside the date gutter and start milestone headers and expanded tracks after them.
- Draw dependency arrows above cards and milestone headers without intercepting clicks.
- Remove milestone bottom borders, including the rule beside the timeline.

- Show a green user-check icon once every request on a ticket is settled and at least one was answered.
- Merge the milestone timeline into the graph's left gutter, aligned with each collapsible milestone header, and remove the Date button.
- Show a ghost milestone with a suggested date when hovering the timeline line; click it to create the milestone.
- Collapse tracks horizontally, and run track columns to the bottom of the panel.
- Edit milestone names and dates and track names in place; replace the milestone menu with a delete button that asks for a second click.
- Draw milestones as header lines with a rule to the progress bar instead of boxed panels, with vertical collapse toggles.
- Keep milestone headers and their dates sticky while scrolling, and narrow the timeline gutter.
- Keep collapsed tracks as shaded columns beside milestone headers.
- Open a milestone's tickets that need a person from its review button and step through them with ← and →.
- Add agent gates: right-click to create a validation an agent must run, with a deliverable it records once through `gate deliver`.
- Give each track the lanes its parallel work needs so cards never overlap, and remove the list display.
- Drop tickets on calendar milestones and highlight the milestone under a dragged ticket.
- Open the background menu at the pointer instead of the frame's corner.
- Replace the New track and New ticket toolbar buttons with a subtle New track button after the last track.
- Show the parent path, such as K-1/K-2/K-3, in ticket details and remove the Track and Due by fields.

## 0.2.1

- Use square corners on milestone progress bars.
- Place clickable date markers directly on the calendar line.
- Launch ticket-linked agent prompts from the ACTIONS overview with Resolve action.

## 0.2.0

- Use the ticket's single-select Track property for product feature branches. Create and assign tracks in the timeline.
- Derive prerequisite-first skill-tree layout and highlight full dependency paths.
- Add persistent task and decision requests, atomic answers, and cancellation through browser and CLI.
- Create tickets from background context menus with track/milestone defaults.
- Show one status icon and compact milestone progress/attention controls.
- Move the interactive calendar line to the right and remove manual dependency sorting.
- Add guarded plan writes with explicit abandoned-claim recovery.
