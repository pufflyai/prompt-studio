# Extension keyboard shortcuts

PS-894 gives extensions the same keyboard catalog as the core. Press Alt+Shift+Space to open keyboard mode. E lists enabled extensions; select an extension to see its keys. G opens a page, C creates something, and A collects actions from every visible selected presentation and attached menu.

These are defaults. Keyboard shortcuts in Settings lists effective bindings, disabled bindings, and unassigned public actions. Personal overrides also update navigation, menu, command palette, and extension inspection hints. An extension does not have to contribute a page to contribute actions.

## Defaults

| Extension | Go or Create | Keys after choosing the extension under E | Current view under A |
| --- | --- | --- | --- |
| Notes | G N Notes; C N new note | O Notes; N new note; F new folder; R rename; M move | N new note; R rename selected note; M move selected note |
| Planner | G P tickets; G T timeline; C P new ticket | O tickets; T timeline; N new ticket; R refine; S status; I implement; B split into children | S status; R refine; I implement; B split into children, using the chosen ticket |
| Artifacts | G A library; C A new artifact | O library; N new artifact; P publish; V revisions | R rename chosen artifact |
| Reports | C R new report | N write; O read; S save | No report editor is invented. Public commands use their normal forms. |
| Font Editor | — | O editor; N add; R rename; C move codepoint; B build; V validate | N/R/C/B/V while the editor is visible; forms collect glyph choices |
| Shape Art | — | O studio; N create piece; R read; P publish | N/R/P while the studio is visible; forms collect piece choices |
| Motion Lab | — | O lab; N create study; F refresh; V read review; P play/pause; R restart | P play/pause; R restart the chosen animation |
| Shader Lab | — | O lab; N add; R rename version; D duplicate; C compare | R/D/C use the chosen shader version |
| Social Radar | — | O radar; N save thread; R daily run; D digest; S status; I reply idea | S status and I reply idea use the chosen thread and its run |
| Development tools | — | O VS Code; I isolated app; S stop; D service discovery | Normal command forms choose a workspace when needed |
| Remote Workspaces | — | N launch | Uses the public launch flow |
| Extension Lab | — | 1–5 open example pages | Keeps its current enabled or disabled state |

The host derives setup actions from public metadata:

- Every enabled extension gets E → extension → K for extension settings.
- Harness providers get N for a new draft with that exact harness and S for agent defaults. The action does not start an agent. Multiple harnesses have distinct chooser labels.
- Skill providers get O to inspect skills and I for agent skill setup.
- Theme providers get T to choose a color theme and I for appearance and file icon settings.

These actions do not depend on provider names. Disabled extensions contribute no active shortcuts. Existing direct shortcuts stay available. Installed external extensions, including Pencil, keep their public actions available for search and personal assignment; their source is outside this repository, so this change does not add provider-specific defaults to them.

## Several panels

With a session in Secondary and a ticket in Main, A shows both applicable action sets. With two tickets, A S opens target selection. Selecting Secondary changes only that ticket. Two presentations of the same ticket produce one resource mutation target. Presentation actions, such as moving a panel, keep separate targets.

Target rows freeze their identities while the chooser is open. If a chosen presentation disappears, execution stops instead of redirecting to a different ticket. Cancel and Back do not apply a partial change.

Left and Right circulate through globally numbered tabs and keep keyboard mode active. Alt+Shift+1–9 select a tab immediately, including from a managed webview. V T selects from larger tab counts. Enter or Escape exits into the selected presentation.

## Embedded editors and previews

Managed webviews negotiate entry chords with the host. Artifacts installs the public keyboard relay in both sandbox documents. Nested content can request keyboard-mode entry or a numbered tab; it cannot forward arbitrary extension commands. The host takes the plain keys after entry and restores the selected editor's focus and caret on exit. Local dialogs and text composition retain their input.

## Release dependency

Extension adoption requires the additive keyboard API in [SDK/core PR #1377](https://github.com/pufflyai/prompt-studio/pull/1377). Keep the extension PR labeled waiting-for-release until that SDK is published, then update dependency ranges and rerun published-extension validation. Do not bypass the published dependency check.
