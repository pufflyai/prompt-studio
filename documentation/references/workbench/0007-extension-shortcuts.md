# Extension keyboard shortcuts

PS-894 gives extensions the same keyboard catalog as the core. Press Alt+Shift+Space to open keyboard mode. G opens a page, C creates a resource, and A collects actions from visible presentations and project tools. Extensions use these shared groups; there is no extension-name step.

Each action has one default shortcut. The Keyboard shortcuts reference groups assigned actions by resource without row subtitles. Personal overrides also update navigation, menu, command palette, and extension inspection hints. Unassigned public actions remain available through command search. An extension does not have to contribute a page to contribute actions.

## Defaults

| Extension | Navigation | Create under C | Actions under A |
| --- | --- | --- | --- |
| Notes | Alt+Shift+O | N note; F folder | R rename; M move selected note |
| Planner | Alt+Shift+P Kanban; G T timeline | T ticket | S status; R refine; I implement; B split into children |
| Artifacts | Alt+Shift+A | A artifact | P publish; V revisions; R rename selected artifact |
| Reports | — | R report | O read; S save, using normal command forms |
| Font Editor | G F editor | G glyph | R rename; C move codepoint; B build; V validate, while the editor is visible |
| Shape Art | G S studio | P piece | R render; P read, while the studio is visible |
| Motion Lab | G M lab | A animation study | F refresh; V read review; P play/pause; R restart selected animation |
| Shader Lab | G S lab | S shader version | R rename; D duplicate; C compare selected version |
| Social Radar | G R radar | T thread; I reply idea for a selected thread | R daily run; D digest; S selected thread status |
| Development tools | — | — | O VS Code; I isolated app; S stop; D service discovery, with normal workspace forms |
| Remote Workspaces | — | S PocketCoder session | Uses the public launch flow |
| Extension Lab | G plus the first letter of each example page | — | Keeps its current enabled or disabled state |

Creation uses the first letter of the resource-kind ID. Shared letters split into numbered choices automatically: C A offers artifact and animation actions; C T offers ticket and thread actions when both tools are enabled. Navigation conflicts use the same numbered chooser. Each chooser shows the full action label.

Creation runs the same UI flow as the rest of the application. Notes open immediately. Tickets use the board's rich creation dialog, including properties and attachments. Artifacts open the library's existing creation choices.

The host derives setup actions from public metadata:

- C S lists new session drafts with the exact harness provider. Select its numbered choice directly; no arrow navigation is required. Creating a draft does not start an agent.
- S E opens extension settings; Mod+, opens agent defaults; S S opens skill setup; S I opens appearance and icon settings.
- Alt+Shift+T is the single color-theme action, regardless of the number of theme providers.

These actions do not depend on provider names. Disabled extensions contribute no active shortcuts. Existing direct navigation shortcuts stay available, including inside shortcut mode. Creation uses its C sequence without duplicate direct chords. Installed external extensions, including Pencil, keep their public actions available for search and personal assignment; their source is outside this repository, so this change does not add provider-specific defaults to them.

## Several panels

With a session in Secondary and a ticket in Main, A shows both applicable action sets. With two tickets, A S opens target selection. Selecting Secondary changes only that ticket. Two presentations of the same ticket produce one resource mutation target. Presentation actions, such as moving a panel, keep separate targets.

Target rows freeze their identities while the chooser is open. If a chosen presentation disappears, execution stops instead of redirecting to a different ticket. Cancel and Back do not apply a partial change.

Left and Right circulate through globally numbered tabs and keep keyboard mode active. Plain 1–9 selects a tab from any keyboard-mode prefix. The default Alt+Shift+1–9 chords select tabs immediately, including from a managed webview; personal assignments can change these chords. Placeholder cards show their panel's tab number. V T selects from larger tab counts. Enter or Escape exits into the selected presentation. Alt+Shift+Up returns from nested navigation to the project.

## Embedded editors and previews

Managed webviews negotiate entry chords with the host. Artifacts installs the public keyboard relay in both sandbox documents. Nested content can request keyboard-mode entry or a numbered tab; it cannot forward arbitrary extension commands. The host takes the plain keys after entry and restores the selected editor's focus and caret on exit. Local dialogs and text composition retain their input.

## Release dependency

Extension adoption requires the additive keyboard API in [SDK/core PR #1377](https://github.com/pufflyai/prompt-studio/pull/1377). Keep the extension PR labeled waiting-for-release until that SDK is published, then update dependency ranges and rerun published-extension validation. Do not bypass the published dependency check.
