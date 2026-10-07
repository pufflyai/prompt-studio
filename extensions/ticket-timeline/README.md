# Ticket timeline

A feature skill tree for the project's Planner tickets. Open **Tools → Ticket timeline**.

## Header controls

The header uses the main ticket Planner toolbar. **Filter** selects status, milestone, and Planner property values such as Track, with removable filter chips and Clear all. Selected values within one property are alternatives; different properties must all match. **Search** matches ticket IDs and titles without case differences. Escape or Close search clears it. Search and filters narrow the visible cards; milestone totals and review queues still use the full saved plan. **Display** keeps the timeline’s done-ticket, completed milestone, attention, and arrow style settings.

## Tracks and prerequisites

Tracks represent vertical product slices, such as Catalogue auditing or Agent chat. Each ticket has one value in Planner's dedicated single-select **Track** property. **New track**, after the last track header, creates an option. Click a track name to rename it in place: Enter or leaving the field saves, Escape cancels. Dragging a ticket into another track changes its actual property. Empty tracks stay visible. Tickets with no value appear in **Unassigned**. The toggle next to a track name collapses it to a narrow shaded column with its name written vertically and hides its cards. Collapsed tracks move beside the date gutter, before milestone headers and expanded tracks. Collapsed columns and their toggles move out of the frame when you pan sideways; only the date gutter stays pinned. Track columns always run to the bottom of the panel, including when milestones are collapsed. Collapsed tracks stay local to the view.

Graph branches come from ticket prerequisites. Cards sit below prerequisites within a milestone, including prerequisites in other tracks. Each track is as wide as its parallel work needs, so cards never overlap; drag empty space to pan the canvas horizontally and vertically. There are no scrollbars. Arrow keys also pan when the canvas has focus. Scroll up over the canvas to zoom in and down to zoom out, keeping the canvas point under the pointer in place. The − and + controls at the bottom also zoom from 25% to 100%. The percentage resets to 100%, the original size and maximum zoom. Zoom stays local to the open view. Select a card to highlight its full prerequisite and dependent paths. Dependency arrows normally draw above milestone separators and below cards. Enable **Square arrows** in Display to use right-angle bends instead of curves. Selecting a node raises its prerequisite and dependent paths above the other nodes and milestone headers; the nodes in that hierarchy stay above their arrows. Arrows never intercept clicks. Green outlines mark available work. Later milestones remain later; a prerequisite in a later milestone is explained rather than silently moved.

Drag tickets between tracks or milestones, or before another ticket. A subtle theme accent marks the destination row and track column, with an outline at their intersection. Dropping on a date keeps the ticket’s current track. Changing track preserves unrelated properties. If a write fails, the error remains visible and the view reloads the saved data.

Right-click empty graph space to **Create ticket**, **Add agent gate**, or **Add artifact** with the current track and milestone selected. The menu opens at the pointer and closes on Escape or a click elsewhere. Supply a title, instructions, track, milestone, and prerequisite ticket IDs. If creation succeeds but placement fails, **Retry placement** moves the existing ticket without creating another.

## ACTIONS and status

The detail panel shows **Blocked reason** below the status. It preserves the saved reason even when human input is requested. Dependency blocks without a saved reason list their unfinished prerequisites; a marked blocker without an explanation says no reason was provided. Completed tickets hide stale block reasons. **ACTIONS** shows existing **Human Needed** tickets’ Markdown body. Agents can attach tasks with completion confirmation or decision forms with single-choice, multiple-choice, and text questions.

**Resolve action** launches an agent prompt in the project session panel. The prompt includes the current ticket instructions, pending tasks and decision choices, and a link back to the ticket. Launching it does not resolve requests, clear Human Needed, or complete the ticket. The agent helps you supply decisions or complete tasks, then records confirmed results. Completed or no-longer-action-required tickets cannot launch a stale prompt.

Responses persist and are readable by agents. Required answers, choice IDs, owner tickets, and request revisions are validated on the command boundary. Only one answer or cancellation can win. Correct a mistaken request by cancelling it and creating a new request; an old open form cannot answer the cancelled request. Saved and cancelled requests remain readable.

Task confirmation records the person's confirmation; the requesting agent verifies the external result. Do not put secret values into a form. Instructions should name the destination, required setting, and link to the service.

Each ticket shows one status icon with a tooltip. State precedence is **Done**, **Await input**, **Input received**, **Blocked**, **In progress**, then **Not started**. Planner's Human Needed flag, pending requests, technical blockers, and unmet prerequisites drive the projection. It never changes Planner's workflow status. When every request is settled and at least one was answered, the ticket shows a green **Input received** icon, even while the Human Needed tag remains; a new open request asks for input again. Resolving an action does not complete its ticket or remove the Human Needed tag; the requesting agent verifies the result and does both.

## Agent gates

An agent gate is a Planner ticket with free-form instructions, prerequisites, a track, and a milestone. Creating it launches a ticket-linked agent review after plan placement succeeds. The prompt asks the agent to inspect the full plan, dependencies in both directions, parent and child work, milestones, dates, blockers, and linked prototypes, then update the plan in accordance with the instructions. It records its findings on the gate ticket and marks it done only after verifying the outcome.

Gate cards use a dashed outline, shaded background, and GATE shield label. The overview shows the instructions and **Review gate** to launch another review while the gate is open. Creation errors preserve the new ticket: retry placement or agent launch without creating another gate.

## Artifact nodes

Right-click **Add artifact** to choose an existing published prototype and give the node a title, description, track, milestone, and prerequisites. Artifact nodes remain Planner tickets, so they fit the same dependency graph and can represent planned or completed outputs. Select an existing ordinary ticket and use **Link artifact** to give it a prototype; **Change artifact** can replace or remove that link.

Artifact cards are wider and taller than ordinary tickets, with a larger sandboxed preview and **Open artifact**, which opens the artifact library’s current page directly. The detail panel also gives linked artifacts more preview space. Previews fit their container width, and lanes, milestone spacing, arrows, and selection navigation follow the actual card bounds. Self-contained scripts can render the preview, but it cannot access the host or use the network. The preview follows the dashboard theme. The artifact library owns content and revisions; the timeline stores only the ticket-to-artifact URL. Updated artifacts refresh the node, and missing artifacts show an unavailable state without hiding the plan.

## Milestones and calendar

Each milestone is a line rather than a panel: its date on the timeline, a collapse toggle, the name in the same style as track names, a review button when tickets need a person, a completion icon, a rule to the progress bar, and a delete button that asks for a second click (its tickets become unscheduled). Milestones have no bottom border. Click the name or the date to edit it in place. Headers stick below the track names while their milestone is in view, with their date on the timeline.

The review button shows how many tickets in the milestone need a person. Clicking it opens the first one in the side panel with ← and → to step through the rest; the canvas brings the selected card into view. Due today is orange; overdue is red with days late in the tooltip. Future and complete milestones use normal colors. Counts include filtered-out tickets.

The milestone timeline runs down the left gutter of the graph. Each milestone's date and marker sit beside its collapsible header, joined by one line that continues dotted past the last milestone. The dates stay at the left edge while you pan; collapsed track columns move with the canvas. Hovering the line between milestones shows a ghost milestone header with a suggested date: between two milestones the date follows the position in proportion, and past either end about one header of distance adds a day. Click the line or the ghost to create that milestone. Drop a dragged ticket on a date to make it due by that milestone without changing its track; the milestone under a dragged ticket is highlighted.

Dates use the extension runtime's local calendar day; date arithmetic and formatting preserve calendar dates through daylight-saving changes. Delete a milestone to move its tickets to Unscheduled.

**Display** selects done-ticket visibility, completed past milestone visibility, work needing attention, and square dependency arrows. Display settings persist for the project; the display button sits in the panel header beside Filter and Search. Selection and collapsed milestones and tracks stay local to the view.

## Data ownership

Planner owns ticket identity, status, descriptions, prerequisites, and Track options/membership. The timeline stores only the bound Track property ID, plan, and display settings. Renaming the property or its values preserves identity. Removing the bound property fails clearly; restore it in Planner settings.

The timeline owns immutable requests in its project `action-requests` collection and one terminal outcome in `action-outcomes` per request. Each request is tied to a Planner ticket UUID. Deleting that ticket removes its action data; archiving preserves it. Agent gates follow the same ownership rule: `agent-gates` only marks the review ticket. `artifact-nodes` stores its owning ticket ID and a library URL. Deleting an artifact node’s ticket removes the reference and preserves the library artifact. Done tickets keep history and disable pending controls.

Planner 0.39.0 cannot conditionally replace a ticket file. Extension storage supplies atomic `createIfAbsent`, so two answers cannot overwrite each other. Actions are read through the public timeline commands, rather than Planner pull/save files. This design was first implemented in Kito's K-131 ticket and imported into Prompt Studio in PS-545.

## Agent CLI

```bash
pst ticket-timeline track create --name "Catalogue auditing"
pst ticket-timeline track assign --ticket K-32 --track <option-id>
pst ticket-timeline track assign --ticket K-32 --track none
pst ticket-timeline ticket create --title "Audit a catalogue" --track <option-id> --deadline 2026-10-15 --depends-on '["K-31"]'
pst ticket-timeline gate create --title "Review the rehearsal plan" --instructions "Review dependencies and prototypes; update the work needed for the rehearsal." --deadline 2026-10-15
pst ticket-timeline gate launch --ticket K-140
pst ticket-timeline artifact list
pst ticket-timeline artifact create --title "Audit UX prototype" --url "<published artifact URL>"
pst ticket-timeline artifact attach --ticket K-140 --url "<published artifact URL>"
pst ticket-timeline action request --ticket K-32 --action '{"title":"Configure GitHub secret","instructions":"Open the repository settings and configure the named secret. Do not paste its value here.","request":{"kind":"task"}}'
pst ticket-timeline action launch --ticket K-32
pst ticket-timeline action read --ticket K-32
pst ticket-timeline action resolve --ticket K-32 --action-id <id> --expected-revision 1 --response '{"confirmed":true}'
pst ticket-timeline action cancel --ticket K-32 --action-id <id> --expected-revision 1 --reason "Replaced with corrected instructions"
pst ticket-timeline plan read
pst ticket-timeline deadline create --date 2026-10-15 --name "Staging acceptance"
pst ticket-timeline deadline update --deadline 2026-10-15 --date 2026-10-17
pst ticket-timeline deadline delete --deadline 2026-10-17
pst ticket-timeline plan move --ticket K-32 --deadline none
pst ticket-timeline display save --display '{"showDone":true,"showCompletedPastDeadlines":true,"attentionOnly":false,"squareArrows":false}'
```

Decision requests use this `action` shape:

```json
{
  "title": "Choose the preview",
  "instructions": "Choose the destination for the next rehearsal.",
  "request": {
    "kind": "decision",
    "questions": [{
      "id": "destination",
      "label": "Where should it run?",
      "kind": "single-choice",
      "required": true,
      "options": [
        {"id": "private", "label": "Private preview"},
        {"id": "demo", "label": "Demo"}
      ]
    }]
  }
}
```

Answer using `{"answers":{"destination":"private"}}`. Multiple-choice answers use arrays of choice IDs. Text answers use strings. Requests have a server-generated ID and revision 1; correcting a request creates a new identity.

## Recovering an interrupted plan write

Plan and Track bootstrap writes use atomic owner claims because SDK 0.39.0 has no transaction around read/modify/write. Failed commands release their claim. A terminated process can leave an abandoned claim. The extension fails closed rather than expiring a claim while a slow writer still runs.

Stop the original writer (including its host process if needed) and confirm that no command is still running. Then inspect `pst ticket-timeline write-claim read` and release only that exact key/token:

```bash
pst ticket-timeline write-claim release --key plan --expected-token <inspected-token>
```

Never release a live writer. A mismatched or changed token is refused. Reload the plan and retry. This limitation is isolated in `write-guard.ts`; replace it when the public SDK offers transactional updates or fencing leases. Action answers use atomic outcomes directly and do not need this recovery.

## Development

```bash
bun install --frozen-lockfile
bun run --cwd extensions/ticket-timeline lint
PSTDIO_HOME="$HOME/.pstdio-dev" pst extensions dev extensions/ticket-timeline
```

Run these commands from the Prompt Studio repository root. Enable `pstdio-planner` before opening the timeline, and enable `pstdio-artifacts` to use artifact nodes. For a production-like install, stop the watcher and run `pst extensions add extensions/ticket-timeline --force`, then `pst extensions check`. The extension uses repo scope, so installation creates `.pstdio/extensions/ticket-timeline` in the linked project.

Run `pst extensions test extensions/ticket-timeline` for an isolated initial-load browser check. Validate the graph, empty branches, context defaults, action errors and saved answers after reload, milestone menus/tooltips, timeline hover and clicks, track collapse, and narrow viewport layout in the live browser. See the [extension development guide](../README.md) for the isolated Docker workflow.
