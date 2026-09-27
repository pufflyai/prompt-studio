# Motion Lab

Executable proposals for chat and workbench motion. Review them in Prompt Studio or Remotion Studio before changing production components. All conversation text and events are synthetic.

## Place in the project

| Location | Owns |
| --- | --- |
| Pencil `.pen` designs | Appearance, spacing, states, and layout |
| `design/motion` | Compositions, fixtures, timing proposals, and review notes |
| `.pstdio/extensions/motion-lab` | Project Tools page with the Remotion Player and review controls |
| `design/DESIGN.md` | Approved interaction rules |
| `@pstdio/ui` and Storybook | Production components and interactive examples |

`@pstdio/motion-studies` and `motion-lab` are private Bun workspace packages, ignored by Changesets. The extension imports the studies by package name and uses the public SDK. Neither production UI nor dashboard code imports Remotion. The lab needs no agent, terminal, database change, or live project data.

## Setup

Run from the repository root:

```sh
bun install
bun run --cwd packages/ui build
bun run --cwd design/motion studio
```

Studio is a standalone design tool. To review inside Prompt Studio, use the isolated app:

```sh
bun run dev:playwright
```

The command prints a dashboard URL and creates an isolated linked demo project. Register the repo-local extension in that project:

```sh
docker exec -it -w /workspace/project pstdio-playwright-prompt-studio-1 \
  /home/bun/.local/bin/pstdio extensions dev \
  "$PWD/.pstdio/extensions/motion-lab"
```

Open **Tools → Motion Lab**. Stop the watcher with Ctrl+C. Stop the isolated app with `bun run dev:playwright:down` when finished. This does not install the lab into your regular Prompt Studio home.

For an already linked development project, use `pst extensions dev .pstdio/extensions/motion-lab` from its root. The extension is repo-scoped. The watcher tracks extension files; after editing the shared studies, restart the watcher to rebuild its snapshot.

## Review controls

New animation reviews begin paused. Choose an animation from the Chat or Workbench folders in the file tree, or search for its title in the command panel. Each study is a `motion-lab.animation` resource with its own route and review settings. The **Playback** strip beneath the preview in Main holds Play/Pause, first/last frame buttons, previous/next keyframe buttons, the scrubber, and event markers. The arrows pause playback and jump to the preceding or following event marker. Hover or focus a marker to read its event name; click it to seek.

The **Playback** panel also owns speed (0.5×, 1×, 2×) and the Loop icon in the same toolbar row as the transport controls. Enable Loop to show its range handles. Drag the start/end handles, or seek to an event and use **Set start here** / **Set end here**. **Reset range** restores the full study. Ranges are saved per animation; seeking while paused can still inspect frames outside the range.

The resizable **Params** menu on the right uses the shared parameter editor for the view, theme, reduced motion, and variant controls. Study descriptions live in its **Info** section. Drag the Main left and right menu dividers to resize the tree and parameters. The preview and exported frames contain only the study scenes.

Single view shows the right-hand variant. Comparison places the left and right variants side by side on one frame clock. Their settings are shown in Params.

- **Instant** removes transition durations. Ongoing loader activity still shows that work is active.
- **Subtle** uses the proposed timings below.
- **Slower** multiplies transition durations by 1.5. Event times, travel distances, the 300 ms tooltip delay, and the 1,200 ms pulse cycle stay unchanged.
- **Reduced motion** removes travel and animated resizing. Loaders stay visible without pulsing or rotating. Direct divider dragging and explicit scroll position changes remain immediate.
- **Working treatment** in Params selects Spinner, Pulse, Scanning line, Aurora background, or Contour field independently for each side. Open **Chat → Working styles** to review them. New reviews default to Spinner versus Aurora; saved reviews keep their choices.
- Aurora and contours are procedural SVG studies of shader-like backgrounds, not GPU shaders. Their geometry comes from frame time. They stay in the activity footer above the composer and freeze under reduced motion.
- **Text arrival** selects Immediate, Chunk fade, or Word reveal independently for each side. New comparisons use Immediate versus Word reveal. Streaming uses a magnified 420 × 640 session crop so the text remains readable in the lab. Chunk fade lasts 240 ms; Word reveal spreads each chunk over 600 ms. Both deliberately delay full readability after arrival, and neither changes historical text. Instant and reduced motion remove these effects.

**Copy configuration** in the Params menu’s Info section copies JSON accepted by the CLI's `--props` option. If clipboard access is unavailable, the page shows selectable JSON. Save it to `design/motion/out/review.json`. Review settings are saved per animation through extension storage. They do not change the source presets or design rules. Main and Params share this state through SDK commands; Playback is mounted with the preview, and frame rendering remains local to Remotion.

## Export

Every study has `-single` and `-compare` composition IDs. Single compositions use 1440 × 900; comparisons use 1920 × 1080. Workbench studies preserve a 1440 × 900 logical layout in either mode. Navigation tree uses a magnified 250 × 640 Sidenav crop. Both use 60 fps.

```sh
bun run --cwd design/motion render chat-turn-compare
bun run --cwd design/motion still panels-single --frame=246
bun run --cwd design/motion render streaming-compare --props=out/review.json
bun run --cwd design/motion still streaming-compare --frame=543 --props=out/review.json
```

Generated MP4s, PNGs, and review JSON belong in ignored `out/`. Repeating an export replaces that composition's output. Match the selected composition ID to the configuration's study and single/comparison mode. Video rendering is CLI-only. The first render downloads Remotion's headless browser.

All Remotion dependencies are pinned to **4.0.529**. Upgrade them together. The render config contains a temporary React subpath alias; see [ADR 0042](../../.pstdio/docs/adrs/0042-temporary-remotion-react-subpath-alias.md).

## Example catalog

| Study ID | Sequence and proposed timing | Judge |
| --- | --- | --- |
| `chat-turn` | Send, wait, first response, stream, finish. Message: 160 ms / 4 px; first response: 140 ms fade; loader: 120 ms in/out. | Stationary composer and elapsed label; old messages never re-enter. |
| `loaders` | Short wait, sustained wait, interruption, completion. Five working treatments: spinner, opacity-only dot (1,200 ms), scanning line, aurora background, and contour field (6 s phase). | Visible activity without competing with the answer; elapsed time across the active turn. |
| `streaming` | Identical timed chunks, bursts, pauses, paragraphs, and code. Close-up comparison of immediate append, a 240 ms chunk fade, and a 600 ms word reveal within each received chunk. Read history, then follow again. | Existing text never fades twice; incoming content does not pull the reader away from history. |
| `tools-queue` | Start tool, expand details, queue twice, remove first, finish tool, begin next turn. Status: 100 ms; details: 160 ms; queue space: 140 ms then 80 ms fade; removal: 120 ms. | Local changes, readable status, stable composer. |
| `panels` | Side Panel opens/closes/reverses; divider drags; Secondary Panel terminal opens/closes. Open: 180 ms; close: 140 ms. | Fixed content geometry during reveals; continuous reversal; immediate divider tracking. |
| `surfaces` | Resource menu, delayed tooltip, dialog, field change inside open dialog, quick reversal. Menu/tooltip: 100 ms / 4 px in, 75 ms out; tooltip delay: 300 ms. Dialog: 140 ms / 6 px in with backdrop fade. | No content-change entrance replay; tooltip does not cover its trigger. |
| `rows` | Create a folder among files, then cancel another creation. Space: 140 ms, then 80 ms fade; removal: 120 ms. | Disabled empty-name action; neighboring rows move together. |
| `tabs` | Close three neighboring tabs, then crowd the strip. Tab gap: 120 ms. | Stable next close target; 48 px minimum tabs. |
| `navigation-tree` | Expand Workspaces, expand a nested workspace, select a session, hover actions, collapse and reverse halfway. Expansion: 160 ms; collapse: 120 ms; hover exit delay: 150 ms. | Shared TreeList rows and section headers; readable indentation; continuous sibling movement; immediate selection. |

Entrances ease out; exits ease in. There is no bounce or overshoot. These timings are hypotheses, not measurements of the reference products.

## Source map

- `src/index.ts`: registry consumed by both Player and Studio.
- `src/model.ts`: study descriptions, default parameters, event markers, durations.
- `src/presets.ts`: proposed transition durations, preset multipliers, loader cycle, and tooltip delay.
- `src/motion.ts`: pure frame-time interpolation, transition scaling, interruption handling.
- `src/scenes/`: scripted studies.
- `src/workbench-frame.tsx`: canonical Pencil workbench geometry: 4 px outer inset and panel gaps, 250 px Sidenav, 40 px headers, 8 px panel corners, and 32 px status bar. The Side Panel starts alongside navigation chrome; Secondary stays beneath Main. Panel reveals clip fixed-width contents.
- `src/session-window.tsx`: Main document and 420 px session Side Panel, with aligned headers.
- `src/tool-timeline.tsx`: frame-controlled tool rows using the shared tool timeline recipe.
- `src/working-treatment.tsx`: frame-driven scanning line and procedural fields.
- `src/fixtures.ts`: synthetic text and deterministic arrival times.
- `src/composition.tsx`: shared canvas, themes, font readiness, and comparison layout.
- `src/studio.tsx`: Remotion composition registration.
- `scripts/export.ts`: CLI exports into `out/`.

Shared component references:

- `packages/ui/src/components/chat-ui/components/chat-input.tsx`: actual composer.
- `packages/ui/src/components/chat-ui/components/working-indicator.tsx`: current spinner and elapsed-time reference. Its wall-clock timer is replaced with frame time in the studies.
- `packages/ui/src/components/chat-ui/`: `ChatMessage`, `ChatWorkspaceHub`, and chat conventions.
- `packages/ui/src/components/chat-ui/components/timeline.tsx`: compact connected tool rows and output blocks; the lab uses the same Chakra slot recipe with frame-driven expansion.
- `packages/ui/src/components/chat-ui/components/chat-panel-composer.tsx`: workspace hub above the recessed composer.
- `packages/pstdio-workbench/src/react/workbench/workbench-side-panel-layout.tsx`: Side Panel geometry reference only; the lab does not import workbench internals. Secondary content stays below Main and does not span Side.
- `packages/ui/src/components/layout/header.tsx` and `packages/ui/src/components/list-row/`: shared workbench header and file rows.
- `packages/ui/src/theme/recipes/`: menu, tooltip, dialog, tabs, inputs, and buttons.
- `packages/ui/src/theme/`: semantic colors, typography, fonts, spacing, and radii.

Menu/dialog shells use shared recipes without live portals or timed open/close effects. Their geometry stays inside the exported canvas. Shared component CSS animations and transitions are disabled inside the composition. All motion, loader phase, elapsed labels, pointer position, and simulated scroll position derive from the current frame. Font loading blocks the first render so Player and CLI use the same typefaces.

## Review and promotion

Record decisions alongside the copied configuration, including composition ID, frame, and reason. Check dark/light themes and reduced motion. Seek backward and jump directly to transition frames. Compare exported frames with the Player.

Only after visual approval should selected rules move into `design/DESIGN.md`, shared UI, and Storybook. These scripted studies cannot prove live input responsiveness, real scroll behavior, or application performance; validate those during production implementation.

### Package entry points

`@pstdio/motion-studies` resolves to study metadata in extension server commands and to the composition exports in browser builds. This keeps React scenes and CSS out of the server bundle. The browser entry and Remotion Studio share `src/registry.ts`. Webviews initialize Prism before loading the review UI.
