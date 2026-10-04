# PRD: Composer modes and provider state

Status: Implemented in PS-459 after design approval. Rich provider readback and verified composition remain capability-dependent.

Updated: 2026-10-04

## Purpose

Let people write an objective, choose `/goal` at the caret, and send that objective without rewriting the message. Keep the submitted objective visible. Use shared controls while preserving each harness's native behavior.

The harness extension owns commands, native dispatch, capabilities and state. The workbench presents them through the public SDK. The core must not implement another goal loop or infer provider behavior from a provider name.

## Design source

The [Pencil design system](../../../design/prompt-studio-design-system.pen) defines these frames:

- `O7AEX`: draft, slash completion, selected goal and submitted objective.
- `bNCZX`: provider details and unavailable status.
- `FxIuM`: combinations and plan progress.
- `bMVMu`: goal lifecycle and edge cases.
- `WbrYo`: plan takeover with three immediate actions.
- `kxEzD`: the existing native question form takes over the composer.
- `OGZkR`: narrow plan toolbar with controls and actions on separate rows.
- `oBiP5`: the draft returns after all pending items are handled.
- `M3HQE1`: plan takeover in a full conversation, with the unsent draft saved.
- `slnPm`: question takeover in a full conversation, with the unsent draft saved.
- `eKREh`: question takeover using the user-edited `u3K8Hd` composer shell.
- `o3x0e`: plan takeover using the user-edited `W1aYAe` composer shell.
- `IK1YY`: the next independent async question appears after the first answer.
- `k8PBtH`: the saved draft and attachment return after all pending requests finish.

Follow the [shared design rules](../../../design/DESIGN.md). Send uses the existing primary IconButton; attach and model controls use ghost styling. Goal and Plan use the same subtle pill styling as ticket tags, at a matching 28 px height. Tags follow model parameters. Slash menus use shared Menu rows without leading icons or outer padding. Do not add status cards, argument dialogs or Reset to default.

## Provider findings

These findings describe native products and current adapters separately. An installed version, trust policy or adapter can expose less than the native product.

| Harness | Native information | Current adapter boundary |
| --- | --- | --- |
| Codex | Goal objective, status, token budget, token use and elapsed time. Goal get/set/clear and update events. Planning is a turn parameter. Native proposal items are distinct from step progress. | Goal mode returns objective and a status/token summary. Planning mode exposes the latest completed proposal and a revision-bound approval action. Expose remaining structured fields before showing them. |
| Claude Code | `/goal` status includes condition, elapsed time, evaluated turns, token spend and evaluator reason. A goal does not change permission mode. Native completion or impossibility clears the active goal. | The adapter forwards `/goal`, but its structured mode state currently reports planning only. Native CLI output is not a stable typed goal-state contract. Rich details require verified adapter readback. |
| OpenCode | Plan is a primary agent. The server exposes agent and command discovery, task lists and command results. | The adapter currently reports no structured modes. A custom command named `/goal` does not establish a persistent native goal. Agent-selection support must be exposed before rendering a Plan mode tag. |

Sources: [Codex App Server](https://learn.chatgpt.com/docs/app-server), [Claude goal behavior](https://code.claude.com/docs/en/goal), [OpenCode agents](https://opencode.ai/docs/agents/) and [OpenCode server](https://opencode.ai/docs/server/).

Provider implementation boundaries: [Codex harness](../../../extensions/harness-codex/src/harness.ts), [Claude harness](../../../extensions/harness-claude-code/src/harness.ts) and [OpenCode harness](../../../extensions/harness-open-code/src/harness.ts). Native command adoption is delivered separately in [PR #893](https://github.com/pufflyai/prompt-studio/pull/893).

## Composer behavior

1. `/` opens completion at a valid caret boundary, including after objective text. The query is anchored to that caret. URLs, file paths and code are ordinary text.
2. Selecting Goal removes only the slash fragment and adds one draft Goal tag. Preserve the objective, selection and attachments. Enter, Tab and pointer selection behave alike. Escape closes completion without changing text.
3. Selecting the same mode again focuses the existing tag. It does not add a duplicate.
4. A draft tag is local intent. Close removes that intent without a native call. Send uses the current draft as the objective through the harness's supported operation.
5. An empty objective disables Send. Selecting Goal on an empty draft must not execute native `/goal` status readback.
6. `#` has no completion behavior. Plain slash text remains editable; closing completion must not turn it into an action.
7. A normal follow-up to an active goal is still a normal message. The submitted objective must not be replaced with each new draft.

## Visible submitted state

Keep tag labels short: `Goal` and `Plan`. Show the full submitted objective and native state in the tooltip and compact details. Keep the close target at its normal size. Select these tags with slash commands; do not show a duplicate Default/Plan parameter picker. Providers declare command-owned parameters with `control: "command"` while retaining their schema and native values. Typed native commands submit directly without a Run native command control.

The label opens a compact Popover with shared Menu styling. This supports focus in the inline objective editor. Hover and keyboard focus show the full objective and state after the shared tooltip delay. Touch and keyboard activation open the same details surface.

The menu contains the full objective, native status, available metrics, freshness and provider detail such as an evaluator reason. Omit absent metrics. Do not synthesize elapsed time, token budgets, step counts or progress percentages. A provider can expose additional labeled read-only information through the same detail surface.

Show only native actions that the harness advertises for the current state. Codex actions do not establish equivalent Claude or OpenCode actions. Refresh status automatically. Native status dots use provider-supplied labels and semantic tones, and action rows use provider-supplied icons. Slash completion stays icon-free.

An unverified submitted reference has no native actions. Its close action is labeled Hide submitted goal and only dismisses that reference. A native mutation requires current verified state and supported action semantics. Refresh before acting; if the objective changed, update details and require a new explicit action. An action that targets the current session goal must be named Clear current goal rather than promising to clear an old objective.

Successful dispatch can show `Sent`; it cannot by itself show `Active`. Show `Starting` while a request is pending, `Checking` during state refresh, and `Status unavailable` when current status cannot be read. Retain the submitted objective from its existing message; do not introduce a second persisted goal record in the workbench.

## Plan and Goal combinations

The current adapters parse one native command with trailing arguments. `/plan /goal X` is not a portable composition. It can make `/goal X` the planning task instead of setting a goal.

Two draft tags are allowed only when the harness explicitly declares and verifies that exact combination. A parameter-based permission or agent selection can potentially coexist with a goal command, but separate native APIs are not proof that their combined execution is supported.

Until composition is verified, disable the incompatible completion row and explain why. Keep the existing tag, objective and slash query. Offer the supported sequence: plan first, then set a goal. Never silently remove Plan, change permissions, concatenate slash commands, or send two hidden turns. Codex's [slash-command guide](https://learn.chatgpt.com/docs/reference/slash-commands) also describes planning before starting a goal.

There are two separate compatibility questions:

- Can this harness start a new goal while a planning selection applies?
- Can an already active goal coexist with a planning task or agent selection?

Validate both. When coexistence is reported, show both states, preserving the existing goal objective. Otherwise expose a supported pause or clear action before changing modes. Do not promise Pause when the native harness has no such action.

Pasted compound command text needs inline review before execution. Preserve it and offer separate supported actions. Unknown commands remain text until the user selects a discovered command or explicitly submits a supported native operation.

## Plans and additional information

A planning selection, generated plan content and a goal are separate facts. Show native plan steps and their progress in the assistant message. Keep the produced plan in history when planning mode ends. Do not mark steps complete from assistant prose, goal completion, or a mode tag disappearing.

Expose native explanations and task lists when the adapter returns them. A task list is not automatically a planning mode or goal. No provider metadata creates an extra execution loop in the workbench.

## Approving a proposed plan

Codex returns completed structured `plan` items in its native thread. While Plan mode is selected, show the latest unapproved proposal as a form that takes over the composer. Preserve any unsent draft and attachments until blocking requests finish. Keep the full plan in the conversation and native details. Ordinary messages such as “approved” do not change the native collaboration mode. Do not infer readiness from assistant prose, step progress or a completed turn without a proposal.

The provider advertises a mode `confirmation` with the native revision ID and an available action ID. Match `W1aYAe`: one compact toolbar with the Plan tag, the current session model as a read-only label and three one-click actions. Read the model from the harness confirmation metadata rather than showing a generic placeholder dropdown. Omit the label when native readback is unavailable; never substitute the model selected for a future turn. Approve and implement uses primary styling, Continue planning uses subtle styling and Skip uses ghost styling. Do not add a title, subtitle or radio choice followed by Send. Continue planning keeps Plan mode and dismisses this decision. Skip dismisses it for now. Both preserve the draft and make no native mutation. The Plan tag can reopen the decision. Reload reads the pending native proposal again; a new revision replaces only that pending item. Native questions precede a waiting plan decision, without interrupting an active form. Question answers follow their native question channel. Approval uses the provider's advertised mode action instead.

Every blocking question or plan decision takes over the chat input, regardless of draft content. Keep the draft under its existing owner while the form is shown. Preserve its text, attachments, cursor, selection, text composition and queued edit state. Do not copy draft text into an answer field or submit draft attachments with a response. Switching forms must not turn an in-progress draft keystroke into an answer or approval action.

Reuse the implemented question form shown in `u3K8Hd`. Match its label font, small text, rounded fieldset, legend position and spacing. Keep its steps, choices, conditional custom answer field, Skip and primary answer button. Question answers and custom answer text belong to the request rather than the chat draft. Its answer button remains disabled until required answers are present. Offer Skip only when the native request supports it. Multi-step questions keep their own progress and answer state.

Show independent async questions one at a time in arrival order. New arrivals queue without replacing the active form or its answers. Each request retains its native identity and response channel. Existing question steps apply only to questions within one request; do not combine independent requests into those steps. Advance after the current response succeeds or a supported Skip completes. A failed response keeps the same form and answers. If the provider withdraws a request, remove that request and advance without sending a response. Rediscover pending native requests on reconnect and ignore duplicates by request identity.

While a blocking form is shown, the saved chat draft cannot be sent. The question's primary button submits only its answers; the plan uses three immediate actions. Do not add explanatory subtitles or a second draft box. After the last blocking item is answered, handled, withdrawn or skipped, restore the saved draft and normal Send or Queue behavior subject to existing runtime availability. Do not automatically submit the draft. Keep queued edits separate.

Approve and implement passes the displayed revision to the provider. Recheck native state and reject stale revisions. Codex starts one normal turn in the same native thread with `collaboration_mode: "default"` and the explicit prompt “Implement the approved plan.” Preserve the existing unsent draft and attachments. The extension stores only the approved revision ID because native history retains proposals without recording this approval decision. It never duplicates the plan text. Re-entering Plan mode must not offer the already approved revision again.

Disable approval while the provider is busy or state is unavailable. Continue planning and Skip remain available when no dispatch is pending. During dispatch, disable repeated actions while retaining the saved draft. A rejected dispatch retains that form with a closable conversation error; refresh before trying again. A failed question answer retains its selections and custom answer text. Approval and question answers never send the unsent draft or consume its attachments. Queued message edits also stay separate. After a native session starts, its failure belongs to the conversation and does not replay approval. Goal and plan implementation cannot be combined until the provider verifies that combination.

This confirmation path applies to Codex structured proposals. Claude's live `ExitPlanMode` permission request and OpenCode's agent selection keep their native paths. Providers without verified approval metadata receive no inferred approval question.

## Lifecycle and edge cases

| Case | Required behavior |
| --- | --- |
| Pending submission | Prevent duplicate Send. Keep the unsent message and its input available if dispatch fails. |
| Paused, blocked or limited | Keep the objective and native state. Show the reported reason and only available actions. Idle or a stopped turn does not establish one universal goal status. |
| Native completion | Show the confirmed outcome. Codex can retain a completed record; its terminal tag can be dismissed locally. If Claude clears its goal, remove the active tag and retain the native outcome in history. |
| Impossible condition or unrecoverable error | Keep the native failure reason in history. Do not call it complete or automatically restart the goal. |
| Background work or evaluation pending | Keep the goal and reported status. Do not invent an evaluation result when the native provider is waiting. |
| Close confirmed submitted tag | Request the supported native Clear or Leave action. Mark it pending until acknowledgement. Disable repeated close while pending. Preserve the draft and attachments. An unverified submitted reference closes locally instead. |
| Clear or leave fails | A confirmed rejection retains prior state. A timeout or dropped response has an unknown outcome: mark last-confirmed state Checking and refresh native state. Show a closable conversation error. For an uncertain mutation, Retry repeats the status read, not the mutation. Never retry against an unverified replacement goal. |
| New objective replaces an existing goal | Mark the draft Replace and keep the original objective in details until Send succeeds. No automatic replacement on completion selection. |
| Inline edit | Keep the objective editor inside the compact surface, separate from the unsent composer text, selection and attachments. Apply requests the supported native edit. Cancel discards only the inline edit. Keep edited text after failure; an uncertain outcome requires state refresh. The follow-up draft remains intact through Apply, Cancel, success, failure and menu dismissal. Do not open a modal. |
| Usage reset on edit or resume | Use the provider's counters. Codex objective replacement can reset usage; Claude resume can restore the condition with fresh metrics. Do not add old and new counters. |
| Reconnect or reload | Read the native session state. Mark last-confirmed data while checking. Unavailable status is not a cleared goal. |
| External native changes | Update the tag and details from native state without overwriting the local draft. Ignore events for another session or an older goal revision. |
| Provider or model change | Rediscover capabilities. Keep incompatible draft intent and explain before Send. Never transfer an active goal into another provider's session. |
| Missing command, trust or policy restriction | Explain the native availability reason. Do not infer support from a command name, silently ignore the action, or send it as ordinary prompt text. |
| Objective validation | Preserve text and show the provider's argument or length rule inline. The native Codex and Claude products currently limit goal objectives to 4,000 characters; the adapter owns validation. |
| Reserved objective word | Typed native input must distinguish an objective from clear/pause/resume actions. If a text-only native API cannot represent it, explain the unsupported value; do not run a destructive action. |
| Attachments with goal input | Use only a native operation that supports them. If unavailable, explain before Send and retain them. Do not discard attachments or send a second implicit prompt. |
| Queued prompt or busy provider | Respect native availability. Keep draft intent and text when an operation cannot run while busy. Revalidate capability and state before dispatch. |
| Narrow toolbar | Keep one 28 px row and short Goal/Plan labels. Keep full objectives in tooltips and details. Scroll remaining controls when needed. |
| Status read | Refresh automatically without a menu item. Preserve the draft while reading. Report unavailable status plainly and use a neutral dot. |

## Acceptance for implementation

- Storybook covers draft, submitted objective, native details, unavailable state, conditional combinations and lifecycle states from Pencil.
- Playwright covers caret completion, keyboard selection, close behavior, provider changes, inline edit and narrow layouts.
- Adapter tests prove native dispatch, acknowledged state changes, capability gating, explicit composition rules and event ownership.
- No inferred goal loop, provider-name switches in the workbench, duplicate persisted native state, hidden second prompt, argument modal or Reset to default action.
- Extend public SDK contracts in the SDK PR first, following extension API versioning. The current command text and opaque mode summary do not yet express all requirements here.
