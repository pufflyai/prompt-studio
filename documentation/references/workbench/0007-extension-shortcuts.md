# Extension keyboard shortcuts

PS-894 gives extensions the same keyboard catalog as the core. Press Alt+Shift+Space to open keyboard mode. G opens a page, C creates a resource, and A collects actions from visible presentations and project tools. Extensions use these shared groups; there is no extension-name step.

Each action has one default shortcut. The Keyboard shortcuts reference groups assigned actions by resource without row subtitles. Personal overrides also update navigation, menu, command palette, and extension inspection hints. Unassigned public actions remain available through command search. An extension does not have to contribute a page to contribute actions.

## Defaults

| Extension | Navigation | Create under C | Actions under A |
| --- | --- | --- | --- |
| Notes | G N notes | N note; F folder | R rename; M move selected note |
| Planner | G K tickets/Kanban; G T timeline | T ticket | S status; R refine; I implement; B split into children |
| Artifacts | G A artifacts | A artifact | P publish; V revisions; R rename selected artifact |
| Reports | — | R report | O read; S save, using normal command forms |
| Font Editor | G F editor | G glyph | R rename; C move codepoint; B build; V validate, while the editor is visible |
| Shape Art | G S studio | P piece | R render; P read, while the studio is visible |
| Motion Lab | G M lab | A animation study | F refresh; V read review; P play/pause; R restart selected animation |
| Shader Lab | G S lab | S shader version | R rename; D duplicate; C compare selected version |
| Social Radar | G R radar | I reply idea for a selected thread | R daily run; D digest; S selected thread status |
| Development tools | — | — | O VS Code; I isolated app; S stop; D service discovery, with normal workspace forms |
| Remote Workspaces | — | S PocketCoder session | Uses the public launch flow |
| Extension Lab | G R Scribble; G B Boombox; G Z Zipline; G P Pigeon; G K Kiln; G M Marmalade | — | Keeps its current enabled or disabled state |

Creation uses the first letter of the resource-kind ID. Shared letters split into numbered choices automatically: C A offers artifact and animation actions when both tools are enabled. Navigation conflicts use the same numbered chooser: G K offers Tickets and Kiln, and G R offers Scribble and Social Radar. Each chooser shows the full action label.

Creation runs the same UI flow as the rest of the application. Notes open immediately. Tickets use the board's rich creation dialog, including properties and attachments. Artifacts open the library's existing creation choices.

The host derives setup actions from public metadata:

- C S lists new session drafts with the exact harness provider. Select its numbered choice directly; no arrow navigation is required. Creating a draft does not start an agent.
- G E opens Extensions; Mod+, opens agent defaults; S S opens skill setup; S I opens appearance and icon settings.
- Alt+Shift+T is the single color-theme action, regardless of the number of theme providers.

These actions do not depend on provider names. Disabled extensions contribute no active shortcuts. Destination navigation uses its G sequence, and creation uses its C sequence, each without duplicate direct chords. Direct Option+Shift chords control panels and tabs and also work inside shortcut mode. Installed external extensions, including Pencil, keep their public actions available for search and personal assignment; their source is outside this repository, so this change does not add provider-specific defaults to them.

## Several panels

With a session in Secondary and a ticket in Main, A shows both applicable action sets. With two tickets, A S opens target selection. Selecting Secondary changes only that ticket. Two presentations of the same ticket produce one resource mutation target. Presentation actions, such as moving a panel, keep separate targets.

Target rows freeze their identities while the chooser is open. If a chosen presentation disappears, execution stops instead of redirecting to a different ticket. Cancel and Back do not apply a partial change.

Ctrl+Tab and Ctrl+Shift+Tab circulate through globally numbered tabs. Plain 1–9 selects a tab from any keyboard-mode prefix. The default Alt+Shift+1–9 chords select tabs and keep keyboard mode active, including from a managed webview; personal assignments can change these chords. Placeholder cards show their panel's tab number. V T selects from larger tab counts. Enter or Escape exits into the selected presentation. Completed creation, navigation, and other actions exit keyboard mode automatically. Alt+Shift+Up returns from nested navigation to the project.

## Embedded editors and previews

Managed webviews negotiate entry chords with the host. Artifacts installs the public keyboard relay in both sandbox documents. Nested content can request keyboard-mode entry, a numbered tab, or a panel control; it cannot forward arbitrary extension commands. The host takes the plain keys after entry and restores the selected editor's focus and caret on exit. Local dialogs and text composition retain their input.

## Release dependency

Extension adoption uses the keyboard API from [SDK/core PR #1377](https://github.com/pufflyai/prompt-studio/pull/1377) and pins the published SDK/UI preview pair from main commit `2c2b2e4c6b144c418cc048219c56553afe938bf4`. It requires a host providing extension API 0.3.0. Future adoption changes that need an unpublished SDK or UI must keep the waiting-for-release label until compatible packages are published; then update dependency ranges and rerun published-extension validation. Do not bypass the published dependency check.
