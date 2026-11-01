# PRD: Reliable documentation and extension authoring

Status: Partly delivered in source on #1188, unreleased. Open findings are listed in the [findings register](#findings-register).
Proposed: 2026-10-18.
Owner: Coordinating implementer of #1188; each open finding names its owner role.

## Goal and scope

A person or agent can follow the public instructions, build a working extension, and understand which capabilities are available in their installed release. Contributors can distinguish product requirements from implemented and released behavior. Bundled skills direct agents to the right documentation when they make a decision.

Complete the public documentation, internal documentation, skill, runtime, environment, and validation work below. Reading List and Reading Shelf are experiment extensions, not proposed core features. Follow the [mission](../../guidance/0001-mission.md), [repository rules](../../../AGENTS.md), and [documentation guide](../../guides/0001-documentation.md).

#1188 first added this plan, then implemented it on the same branch. The earlier local audit edits were not reused; every correction was made again against current source. Merging #1188 does not release packages or deploy the public docs; see R36.

## Evidence baseline and limits

The audit ran on 2026-10-18 against [77fa5d81](https://github.com/pufflyai/prompt-studio/commit/77fa5d8113f13a7f49032446b7fe7857ce213624), with Linux x64, Bun 1.4.2, Node 24.19, and Docker 28.4. Published CLI/SDK were 0.43.1 with extension API 0.1.6; source used API 0.2.0 despite the same package version. These are historical observations, not current release declarations.

This plan starts from [45580feb](https://github.com/pufflyai/prompt-studio/commit/45580febf10d6f879cd6acb3962a0d2856ca20be). Since the audit, #1146, #1163, #1164, #1165, and #1169 added account authority, authenticated relay transport, native runtime connections, and transparent data/view sync. Recheck all affected claims. In particular, do not copy the audit's earlier “cloud sync remains proposed” conclusion onto newer code.

The table below is the audit's own record. New evidence from the implementation is in the [delivery record](#delivery-record) and the [findings register](#findings-register).

| Area | What the audit established | Limit |
| --- | --- | --- |
| Public onboarding | Published CLI installation, non-Git folder projects, same-folder reopening, default workspace, notes, worktree creation/link/delete, and agent detection/skill setup worked. | Git executable was still needed for GitHub extension downloads; no live authenticated agent session. |
| Extension tutorial | Verbatim Bookmarks example typechecked with published SDK; UI add/reload, CLI add/list, and shared data worked. | Grouped storage used a memory adapter; this did not prove relay or restart durability. |
| Internal docs | All 16 central PRDs reviewed; 265 targeted behavioral checks passed. | Provider fixtures and source inspection do not prove native release or live provider acceptance. |
| Website | Production build passed with 97 routes, including 72 docs pages; checked file links and published anchors resolved. Install worked at 390px without horizontal overflow. | No exhaustive cookbook, screenshot, extension-doc, or external-link audit. |
| Skills | Nine skills and 18 Markdown files reviewed. Original local links resolved, but seven Planner/Reports/Artifacts skills had no central-doc links. | Link counts alone do not establish usefulness. |
| Revised skill experiment | Two exported skills delivered 25 files with 52 working local links. The retest found the public walkthrough and handled API mismatch correctly. | These were local draft corrections, not a released package. |
| Runtime packaging | Initial CLI verification: 77 passed, 8 failed, 1 async error across 85 tests. Five browser-setup failures passed after installing the matching headless shell; a cascading ticket failure passed alone. | Two lifecycle failures remained; packaged-browser verification was never reached. Full verification was not green. |
| Sync conformance | Two attempts stopped before scenarios: tester health request returned HTTP 403, “No approved upstream IPv4 address”; object-store health inside its container was 200. | Environment/proxy blocker, not evidence of a protocol failure or pass. |

The baseline agent built **Reading List**; the retest built **Reading Shelf**. Both supported a native table, add form, mark read, All/Unread filtering, delete, reload persistence, live UI/CLI updates, and separation across two real projects. Baseline tests passed 4 tests/19 assertions; retest passed 4 tests/17 assertions, plus TypeScript.

Each author had fresh context, a disposable author container, copied read-only skills, public packages/docs, and no application checkout. They shared one disposable app host. Versions were mixed, briefs differed slightly, and only one agent ran per condition. Do not claim a causal speed improvement or complete host isolation. The baseline broadened its API range without testing an older host; the retest retained the required API range. Inspecting public SDK declarations for exact types is expected, not itself a failure.

## Delivery record

Implemented on branch `chore/docs-and-skills-remediation-plan` (#1188) and validated on 2026-10-18 on macOS arm64 with Bun 1.4.2 and Docker 29.7.2, plus Linux containers where noted. Nothing here is released yet: the stable release is 0.43.1 with extension API 0.1.6. Public pages describe `main` and label what 0.43.x lacks with "the release after 0.43.x".

| Workstream | State | Main changes | Evidence |
| --- | --- | --- | --- |
| W1 | Delivered in source | Skill install contract in the [installer](../../../packages/pstdio/src/features/skills/install-skills.ts) and [workspace sync](../../../packages/pstdio-extensions/src/artifacts/workspace-sync-dir.ts); register below | Installer, setup, sync, and e2e tests; real-folder run of install, reinstall, edit, and `--force` |
| W2 | Delivered in source | Public guides and references, PRD delivery records, architecture and development guides, bundled skills | SDK reference names all 15 client groups; links and routes checked; stable 0.43.1 CLI runs |
| W3 | Delivered in source | [Version explanation](../../references/extensions/0014-api-versioning.md#app-sdk-and-extension-api-versions), [Bookmarks example](../../../infra/local/extensions/bookmarks), skill routing index, release checklist in [PRD 0005](0005-versioning-and-releases.md) | Walkthrough run verbatim on 0.43.1 and on a `main` stack, CLI and UI |
| W4 | Delivered in source | Bare-group help, complete piped output ([ADR 0127](../../adrs/0127-temporary-cli-console-stream-binding.md)), `extensions add .`, check target and version labels, zombie-aware runtime close, harness listing across installs | Failing-first tests for each; packaged lifecycle runs in Linux containers without init |
| W5 | Delivered in source, one decision open | Packaged browser provisioning, CA and credential handling, named volumes, proxy bypass for fixtures, [trial isolation](../../guides/development/0001-setup.md) | Clean browser path runs; conformance, storage, assets, transport, relay, and account suites with and without a simulated proxy |
| W6 | Partly delivered | Resource-link CLI journey, undeclared-kind error, cookbook and automation guide fixes, navigation group ownership | Isolated stack runs with the CLI and scripted Playwright; real Codex session; signed macOS 0.43.1 app checked |
| W7 | Delivered in source | `verify:docs-links`, `verify:sdk-reference`, `verify:docs-snippets` in `static_checks`; weekly external links; ownership rules in the [documentation guide](../../guides/0001-documentation.md#documentation-checks) | Detection shown for a broken exported link, a missing asset, a missing SDK method, and a drifted snippet |
| W8 | Partly delivered | One fresh-agent trial (create an extension) with the packaged skills, a local build of the public docs, and the stable 0.43.1 CLI in a throwaway home | Every requirement passed through the CLI; the UI was not opened; trials 2 to 4 were not run (R49) |

## Findings register

States: fixed and verified, open, blocked, accepted limit. "Fixed" means fixed in source on this branch and covered by the listed evidence; it does not mean released.

| ID | Finding | State | Owner | Closure evidence or next step |
| --- | --- | --- | --- | --- |
| R01 | Installer rewrote same-name skills despite the PRD | Fixed and verified | CLI maintainers | `install-skills.p0.test.ts`, `setup.p0.test.ts`, `src/cli/agents.p2.test.ts` |
| R02 | Workspace sync overwrote unowned and edited skill files | Fixed and verified | Runtime maintainers | `workspace-files-mount.p0.test.ts`, `workspace-files.p0.test.ts` |
| R03 | Kept skill files are reported only in the host log at `warn` level | Open | Product owner | Decide whether a visible notice is needed |
| R04 | `syncDir` doc comment in `pstdio-api-contracts` predates the ownership rule | Open | SDK maintainers | Update in a separate SDK PR (the separation check forbids it here) |
| R05 | Packaged auto-start and close hit 60 s under a non-reaping PID 1 | Fixed and verified | Runtime maintainers | `process-liveness.p1.test.ts`; Linux no-init runs at about 1.8 s; [lesson 0017](../../lessons-learned/0017-unreaped-processes-look-alive.md) |
| R06 | Zombies still collect under a non-reaping PID 1 | Accepted limit | Runtime maintainers | Run containers with an init process, as CI does |
| R07 | "Harness has been disposed" after installs | Fixed and verified | Runtime maintainers | `agent-listing-during-install.p1.test.ts` |
| R08 | A listing can still fail once if the listed harness's own source changes mid-request | Open | Runtime maintainers | Decide whether retired handles should finish in-flight reads |
| R09 | Piped `--json` output stopped at 64 KiB | Fixed and verified (temporary) | CLI maintainers | `piped-output.p2.test.ts`; remove per ADR 0127 when Bun drains `console` writes |
| R10 | Bare command groups failed without the API | Fixed and verified | CLI maintainers | `src/cli/feedback.p2.test.ts` |
| R11 | `pst extensions add .` was read as a catalog name | Fixed and verified | CLI maintainers | `extensions-add-paths.p1.test.ts`, `add.p0.test.ts` |
| R12 | Checks did not say what was checked or whose versions were compared | Fixed and verified | CLI maintainers | `check.p0.test.ts`, `package-manifest-api-versions.p0.test.ts`, runtime `check.p0.test.ts` |
| R13 | The host's own app and extension API versions are not reported | Open | SDK and runtime maintainers | Add `host` versions to the diagnostics contract in an SDK PR |
| R14 | Source and installed checks use different inner JSON shapes | Accepted limit | CLI maintainers | Both shapes are documented; unify when the source check can call the host checker |
| R15 | Packaged tests launched a browser the installer does not provision | Fixed and verified | Developer tooling | Clean `PLAYWRIGHT_BROWSERS_PATH` runs; CI installs `--no-shell` only |
| R16 | Isolated stack needed image edits behind a managed proxy and CA | Fixed and verified | Developer tooling | `NODE_EXTRA_CA_CERTS` build context, tested with a test CA |
| R17 | Missing login files became empty folders on the host | Fixed and verified | Developer tooling | `isolated-host-files.p0.test.ts` |
| R18 | `--down` left unnamed `node_modules` volumes behind | Fixed and verified | Developer tooling | Start, recreate, and down leave zero volumes |
| R19 | Cold first `dev:isolated` start outlasts the 90 s readiness wait | Blocked on approval | Developer tooling | Measured 171 s and 176 s; needs an approved readiness rule |
| R20 | API requests stall while default extensions install | Open | Runtime maintainers | Requests should answer or fail clearly during installs |
| R21 | Sync fixture readiness failed behind a proxy (HTTP 403) | Fixed and verified | Developer tooling | `NO_PROXY` for fixture hosts; suites pass behind a simulated proxy |
| R22 | Public docs omitted linked-project and Git prerequisites, SDK methods, and release labels | Fixed and verified | Documentation maintainers | `verify:docs-links`, `verify:sdk-reference`, stable CLI runs |
| R23 | Authoring skill duplicated a 509-line API copy without decision routing | Fixed and verified | Extension maintainers | Routing index and exported-folder link checks |
| R24 | Seven Planner, Reports, and Artifacts skills had no central references | Fixed and verified | First-party extension owners | Public URL and anchor checks |
| R25 | PRDs did not separate implementation, release, and acceptance | Fixed and verified | Documentation maintainers | Delivery records in each PRD |
| R26 | Dashboard synced a removed `templates` table | Fixed and verified | Dashboard maintainers | Dashboard sync tests |
| R27 | `local-example` tests never ran | Fixed and verified | Developer tooling | `test` script added |
| R28 | The npm `pst` launcher needs Node.js | Accepted limit | CLI packaging | Documented in the [install guide](../../guides/getting-started/0001-install.md#install-only-the-command-line-tool) |
| R29 | Extension API moved 0.1.3 to 0.1.6 between 0.43.0 and 0.43.1 | Open | SDK maintainers | Confirm whether the one-step rule applied then, and fix the check or the rule |
| R30 | Sync cascade deletes may miss a child created mid-delete | Open (hypothesis) | API maintainers | Add a race test |
| R31 | No recorded two-environment sync journey or conflict UI | Open | Platform owner | Record a two-dashboard browser journey |
| R32 | Planner resource-link adoption and path opening | Blocked on release | Planner owner | #1156 needs a stable SDK with `paths` |
| R33 | Dead GitHub Actions run links in ADRs 0032 and 0039 | Fixed | Documentation maintainers | Runs replaced with plain IDs |
| R34 | `signInBrowser` may leave runtimes after a failed sign-in | Open (suspected) | e2e maintainers | Force a failure and check for leftover processes |
| R35 | Docker address pools exhausted by many stacks | Accepted limit | Each stack owner | Documented in the setup guide |
| R36 | Release, docs deploy, and post-release verification | Open | Release owner | Happens after merge through the normal release workflow |
| R37 | Resource links have no dashboard entry point; the "Related resources" command has no menu or palette placement | Open | Workbench and dashboard maintainers | Place the command and pass the search, link, open, and unlink journey in Playwright |
| R38 | Linking to an undeclared resource kind reported "ambiguous" | Fixed and verified | Platform API | `resource-link-policy.p1.test.ts`; live stack message |
| R39 | Codex runs with `approvalPolicy: "never"`, so approvals cannot be tested | Open | harness-codex owner | Decide and document the approval policy |
| R40 | Real OpenCode and Claude Code sessions not run (expired OpenCode key; no Claude credential in the container) | Blocked | Machine owner | Renew credentials, then rerun one short session each. Codex passed a first turn and a follow-up |
| R41 | Windows and Linux desktop installs and update channels not validated natively | Blocked | Release maintainers | Run on each platform. macOS 0.43.1 app signature, notarization, and CLI checksum were verified |
| R42 | Section-header actions are skipped by Tab; long-press opens no menu on board cards | Open | UI library | Fix in `packages/ui` with stories and Playwright |
| R43 | `pst --help` shows only core commands while extensions still load, without saying so | Open | CLI maintainers | Show a loading note; documented in [CLI-ready actions](../../guides/extensions/0007-cli-ready-actions.md) for now |
| R44 | Opening a ticket URL directly shows "Ticket" and the raw ID | Open | Planner and workbench maintainers | Resolve the label on direct load |
| R45 | A restarted dev stack served a stale workbench build | Open | Developer tooling | Find the cause |
| R46 | Docs site checks at 1280 and 390 px, the smoke-check guide, and the screenshot in CLI-ready actions not verified | Open | Documentation maintainers | Run the checks and recapture if needed |
| R47 | Equal navigation group labels from different extensions show twice | Open (design decision) | Design | Ownership is documented in [navigation](../../references/workbench/0004-navigation.md); decide whether to show the owner |
| R48 | Fresh-agent extension trial | Fixed and verified (CLI only) | Independent validator | Reading List built from the packaged skills on 0.43.1; all CLI requirements passed |
| R49 | Fresh-agent trials for editing an extension, first-party skills, and version mismatch | Open | Independent validator | Run them with the packaged skills after merge |
| R50 | In a project created before the install, a user-scope extension's CLI commands ran before it was turned on there | Open (unconfirmed) | Runtime maintainers | Reproduce, then decide whether CLI calls must respect project enablement |
| R51 | `pst <extension> <command> --help` does not mark required options | Open | CLI maintainers | Mark required options in extension command help |
| R52 | Data tables cannot open a form from a row action, and the walkthrough has no edit flow | Open | Extension maintainers | Document the toolbar edit pattern or add a row form |

## Delivery order and ownership

P0 means a prerequisite or a blocker to trusting the workflow. P1 means required follow-through before closing this initiative. Assign real owners and tickets using `pst`; save edited tickets with `pst tickets save --id PS-XXX`. Keep findings visible until they pass or have an explicitly accepted follow-up with truthful user-facing limits.

| Workstream | Priority | Suggested owner | Depends on | Reviewable output |
| --- | --- | --- | --- | --- |
| W1: Reconcile contracts and findings | P0 | Coordinating implementer + relevant product owner | None | Current evidence register and skill replacement decision |
| W2: Correct public/internal docs and skills | P0 | Documentation + extension maintainers | W1 for disputed contracts | Focused corrections with reproduction evidence |
| W3: Canonical, release-aware guidance | P1 | SDK + documentation maintainers | W1; coordinate with W2 | Version rules, canonical references, executable example |
| W4: Repair authoring/runtime failures | P0/P1 | CLI + runtime maintainers | W1 reproduction; W5 where needed | Behavioral fixes and focused regressions |
| W5: Make validation reproducible | P1; unblock P0 work first | Developer tooling maintainers | W1 environment diagnosis | Repeatable isolated setup and conformance runs |
| W6: Close product acceptance and usability gaps | P1 | Platform + first-party extension owners | W2–W5 as relevant | Real journeys and explicit remaining limits |
| W7: Prevent drift | P1 | Documentation + CI maintainers | W1/W3 contracts | Maintained checks and ownership rules |
| W8: Repeat fresh-agent trials and release verification | Final gate | Independent validator | W2–W7 complete for tested scope | Reproducible acceptance report and release evidence |

Keep documentation, runtime, environment, and automation changes reviewable in separate implementation PRs when practical. W3/W7 can progress alongside independent W4/W5 repairs. W8 must consume the final packaged skills, not an intermediate source snapshot.

## W1: Reconcile requirements with current behavior

1. Inventory public guides/references, extension READMEs/docs, internal PRDs/ADRs, and all bundled skills. Record each finding with an ID, owner, affected files, source/release version, expected/actual behavior, reproduction, evidence, dependency, and closure check.
2. Classify each as documentation error, implementation gap, proposed work, missing acceptance evidence, or environment blocker. Give it an explicit state: open, reproduced, fixed and verified, superseded with evidence, or blocked with owner. A passing source inspection is not a passing end-to-end journey.
3. Recheck audit findings on current main and the current stable release. Pay particular attention to account manager, relay, sync, the development launcher, and CI changes since the audit. Do not apply old patches wholesale.
4. Resolve the skill installation contradiction before finalizing its docs. [Templates and skills](0004-templates-and-skills.md) promised preservation of same-name skills; [the installer](../../../packages/pstdio/src/features/skills/install-skills.ts) removed and rewrote each directory. Define ownership, upgrades, local edits, collisions, and any explicit replacement action. Protect local edits unless replacement is intentionally requested. Do not simply rewrite the PRD to bless destructive behavior.
5. Implement the chosen contract at its owning layer; align the PRD, CLI help, general skill, and authoring references. Validate actual agent-directory installation for first install, reinstall, edited existing content, and packaged assets. Reuse the installer tests and add meaningful cases for the chosen contract.

Done: Every audit finding below has a current disposition and owner. The installation contract is unambiguous, implemented, and proven with real files.

## W2: Finish the verified documentation and skill corrections

Public targets: [getting started](../../guides/getting-started), [authoring](../../guides/extensions/0001-authoring.md), [SDK guides](../../guides/sdk), [SDK method reference](../../references/sdk/0003-api.md), [workspace CLI reference](../../references/cli/0005-workspaces.md), and [Codex README](../../../extensions/harness-codex/README.md).

- Explain linked-project prerequisites for extension installation. Use one explicit extension source path and a distinct linked project directory throughout the Bookmarks walkthrough.
- Explain that downloading default GitHub extensions needs the Git executable; a folder project need not itself be a Git repository. Include Git, Compose, clone, and working-directory prerequisites in contributor setup.
- Reconcile every public SDK group/method with current declarations; the audit found 14 omissions across 15 groups/111 methods. Recount rather than treating those numbers as a permanent contract.
- Label asset and grouped-storage APIs by released availability. The audit's published SDK lacked `client.assets`, `storage.assets`, and `storage.records`; updating the SDK alone did not update the host.
- Use `WS-1` for standalone workspaces and explain ticket-attempt identifiers such as `PS-12_A1`.
- Describe Codex app-server and `thread/read` where current; remove stale `codex exec` and direct session-file-history claims. Label source/fixture verification separately from authenticated execution.

Internal targets: [requirements](..), [architecture references](../../references/architecture), and [development guides](../../guides/development).

- Give each PRD a concise delivery record: requirement, main implementation, released availability, remaining work, and dated evidence. Keep proposed features marked proposed. Accepted ADRs do not prove implementation or release.
- Reconcile desktop browser authentication with [ADR 0057](../../adrs/0057-browser-sessions-in-per-origin-storage.md): origin-scoped browser secret, bearer transport, and single-use login at the audit baseline, not the obsolete HttpOnly-cookie claim. Distinguish this from newer account-manager authentication.
- Recheck synchronized table coverage, including `board_views` and `board_default_views`; the audit found 11 tables. State that cascade notifications follow successful deletion where that remains the implementation.
- Document migration placeholder owners and asynchronous extension downloads while retaining errors for unknown owners, ambiguous ownership, and normalized-name collisions.
- Update cross-platform references to removed source paths and current PR/merge-queue/main CI scope. Document the dashboard package runner's production conditions and tsconfig override for targeted tests.
- Separate resource-link/path-opening host support from Planner adoption, guards, declarations/resolvers, legacy cleanup, and published SDK availability. Host/SDK/UI path support landed in #1155; that alone did not complete Planner journeys.
- Reassess sync delivery against the newer account/relay commits. Separate protocol tests, local storage, real transport, recovery, authorization, and product acceptance.
- Distinguish composer goal/plan/state/confirmation fixture coverage from rich metrics, complete UI composition, and live provider proof. Preserve unresolved bare CLI-group help as a requirement.
- Keep [backend isolation](../../adrs/0058-isolate-extension-backends.md), [repository trust](../../adrs/0059-trust-step-for-repo-extensions.md), and dynamic page titles proposed unless new implementation and evidence justify a status change.

Skill targets: [pstdio-skills](../../../extensions/pstdio-skills/skills), [Planner skills](../../../extensions/pstdio-planner/skills), [Reports skill](../../../extensions/pstdio-reports/skills), and [Artifacts skill](../../../extensions/pstdio-artifacts/skills).

- Route `create-pstdio-extension` to the working walkthrough first, then link the relevant contract at each decision: version preflight, scope/source location, storage, native actions, navigation, webviews, and validation. Use public URLs/anchors from exported skills; repository-relative links cannot assume an application checkout.
- Keep focused offline instructions and bundled relative assets usable after export. Explain `rowId`/`rowIds` versus `onRowActivate`'s `row`, plain-array collection results, update-only operations, persistence before events, and real project separation.
- Explain reusable source versus installed copies, user/project scope, and absolute-path installation from a linked root while W4 diagnoses relative paths. Never edit disposable installed copies as the canonical source.
- Replace full-monorepo validation instructions with targeted checks consistent with repository rules. Explain local source checks versus connected-host checks and their JSON/result shapes.
- Correct general skill guidance on workspaces, queued/disconnected sessions, agent defaults, and documentation folders. Do not imply that a documentation tree is generated automatically or that a deprecated archive alias preserves a workspace when it actually deletes it.
- Add decision-specific central references to all seven Planner/Reports/Artifacts skills. Distinguish the user's repository PRDs from Prompt Studio's own product requirements. Replace deprecated status-provider advice and use `depends_on` for dependencies rather than persisting a duplicate “blocked” state solely for waiting.
- Add contributor guidance for maintaining skills. Allocate the next available document number; the audit's draft `0008` development guide now collides with `0008-two-dashboard-relay.md`.

Done: Reproduce corrected public commands from a clean project, verify referenced contracts against current source, and check deployed/exported links. Every remaining implementation gap remains visible rather than disappearing in prose edits.

## W3: Make guidance canonical and release-aware

1. Define one clear explanation of app version, SDK package version, and extension API version, following [API versioning](../../references/extensions/0014-api-versioning.md). State which version each check uses and how to align host and tooling.
2. Make the normal public walkthrough work on the current stable release. Label main-only capabilities explicitly, with a verified release boundary and a stable alternative where one exists. Never widen a manifest range just to silence a checker; execute every runtime line claimed as supported.
3. Keep one maintained contract per API, with source-linked types as signature authority. Replace the 500-plus-line duplicated author-skill `references/extension-api.md` with a concise routing index and focused offline essentials. Preserve useful offline access and package every referenced local asset.
4. Maintain an executable Bookmarks-style example covering add, update, filtering, deletion, persisted data, native UI actions, CLI parity, and project separation. Extract or verify snippets against that example so copy/paste instructions cannot drift independently.
5. Ensure release/deployment instructions update version labels, examples, screenshots where needed, public references, and shipped skill links together.

Done: A fresh author can identify supported APIs without reading internal PRDs, use the released example verbatim, and find exact contracts from the installed skill.

## W4: Repair failures exposed by the workflows

Reproduce each issue on current main before changing code. Fix at the owning layer and add a failing behavioral regression first where useful. The observations identify symptoms, not confirmed root causes.

| Priority | Finding and reproduction | Required result |
| --- | --- | --- |
| P0 | Packaged detached auto-start/close took 60,059ms and port-zero reuse/close took 60,066ms against existing 60,000ms limits. A later ticket check cascaded; one close assertion became an async error. Compiled `pstdio close` and a defunct process under container PID 1 were observed. | Diagnose launch/reuse/close/reaping phases; preserve budgets, clean up processes, and prove both tests plus the affected sequence pass. Do not declare PID 1 the cause without evidence. |
| P0 | After extension/skill installation, `pst agents list` transiently returned `Harness has been disposed: pstdio.harness-codex.harness.codex`; a later retry recovered. | Reproduce installation/invalidation ownership and keep harness access valid across replacement. A successful retry alone is not a fix. |
| P1 | Installed-extension check JSON piped through `tee` stopped at 65,536 bytes and was invalid; direct redirection produced valid 321,515-byte JSON. | Preserve complete output for terminal, redirected, and piped consumers; validate parseability/content with a result larger than 64KiB. |
| P1 | Bare `agents` with auto-start disabled exited 1 without help; `agents --help` succeeded offline. | Bare command groups show help without starting or requiring an API; unknown commands retain error/help behavior. |
| P1 | `pst extensions add . --force` in the author directory failed with `Project not found: .`; an absolute source path from the linked root succeeded. | Separate expected linked-project preconditions from source-path resolution. Test `.` inside a linked project and author folders outside it; support documented contexts or give precise recovery guidance. |
| P1 | Source check used local API 0.1.6 while connected host supported 0.2.0. Source JSON used `check`; installed checks used `checks`. | Identify the checked target and versions clearly; document/maintain intentional result shapes. Do not confuse a tool mismatch with broken extension logic. |

Start at [extension check](../../../packages/pstdio/src/adapters/cli/commands/extensions/check.ts), [skill installation](../../../packages/pstdio/src/features/skills/install-skills.ts), and [packaged runtime tests](../../../packages/e2e/src/packaged). Follow ownership into runtime/catalog code after reproducing the failure.

Done: Fresh reproduction and post-fix results accompany each change. Run relevant package checks and affected packaged sequences. Never increase timeouts, retry away failures, or shrink workloads to make them pass.

## W5: Make the validation environment repeatable

- Align browser provisioning and launch configuration. The extension installer used Chromium `--no-shell`, while affected Playwright tests launched the default headless shell. Install the pinned matching browser artifact or consistently launch the provisioned browser; prove a clean environment works.
- Reproduce `bun run dev:isolated` with documented managed proxy and CA configuration. The audit needed a temporary CA override, omitted a Claude installer after a Docker layer error, supplied empty credential mounts, and removed its own build cache under disk pressure. That was a modified validation image, not an untouched setup pass.
- Diagnose missing credentials, optional provider installation, layer failures, and disk requirements separately. Provide clear prerequisites and supported setup paths; do not claim authenticated provider acceptance using stub credentials.
- Fix the sync fixture's readiness path through approved network/proxy configuration. The audit's HTTP 403 occurred before conformance scenarios. Run current relay/account/transport scenarios using the updated guides; retain logs showing readiness and actual scenario execution. Do not bypass network controls.
- Give every trial a distinct runtime home, Docker stack, ports, projects, and cleanup. Preserve source/evidence before teardown; remove only task-owned containers, volumes, and credentials.

Targets: [setup](../../guides/development/0001-setup.md), [testing](../../guides/development/0002-testing.md), [relay](../../guides/development/0006-relay.md), [account manager](../../guides/development/0007-account-manager.md), and [two-dashboard relay](../../guides/development/0008-two-dashboard-relay.md).

Done: A second clean environment can repeat the documented setup and relevant validation without undocumented image edits. External blockers have an owner and evidence; they are never recorded as passing tests.

## W6: Close acceptance and usability gaps

1. Complete or explicitly scope remaining first-party resource-link and path-opening journeys. Exercise Planner draft/saved paths, ownership/guards, search/link/open/unlink, and expected unavailable states through both UI and CLI where exposed. Remove obsolete paths only when migration and API deprecation rules allow it.
2. Validate real authenticated agent sessions, follow-up/steering, and approvals for supported providers. Record provider/version and distinguish these results from protocol fixtures and executable detection.
3. Validate native Windows/macOS installation, signed desktop launch, and update channels in their supported environments. Linux path tests are not native platform evidence.
4. Execute the remaining cookbook examples and extension walkthroughs. Review screenshots against the tested release, check navigation on desktop/mobile, and check external links. Give each page an observable successful result and troubleshooting at the point of failure.
5. Review hover-only row actions for discoverability, keyboard, and touch use. Review duplicate “Tools” sections: navigation groups were scoped by `extensionId:label`, so equal labels did not create a shared group. Explain ownership and choose any UX improvement from [design guidance](../../guidance/0002-design.md); do not invent undocumented global grouping behavior.
6. Assess readability with fresh users/agents: prerequisites found before failure, stable names/paths, first useful result, recovery guidance, and correct understanding of persistence/scope. Record wrong turns and needed help, not only completion time or link counts.

Done: Each product promise has suitable behavioral evidence or a clearly labeled limitation and owned follow-up. UI changes use the shared design system, stories where appropriate, and Playwright verification.

## W7: Prevent documentation and skill drift

1. Add maintained checks for relative links, published routes/anchors, and exported skill assets. Validate installed/exported locations, not only source paths. Keep private PRDs/architecture/development material out of the public allow-list.
2. Check SDK reference coverage against public declarations and compile/execute maintained examples against the supported release. Check meaningful contracts; do not assert literal instructional wording.
3. Keep documentation-only validation lightweight. Source/bundled behavior changes receive the relevant package, integration, and packaging checks. Do not add full application suites merely because prose mentions source paths.
4. Schedule external-link verification separately from deterministic PR checks so remote availability does not make unrelated PRs flaky.
5. Give each canonical guide/reference/skill an owning package or team. Require API changes to update the contract reference, relevant workflow/example, and skill routing together. Include fresh-agent trials when authoring contracts change.
6. Follow current [CI scope](../../../scripts/ci/pull-request-ci-scope.ts) and [workflow](../../../.github/workflows/test-and-build.yml); document actual checks and release gates, not a stale workflow sketch.

Done: Demonstrate that a broken exported link, missing referenced asset, or incompatible maintained example is detected by the intended check. Routine wording edits do not need application tests.

## W8: Final fresh-agent and release gate

Use new agents with no prior conversation, audit results, application source checkout, or other agent's artifacts. Give each an independent disposable author environment **and app host**, actual packaged skills, public documentation access, and the same written task. Record exact prompts, package/host/API versions, OS, commands, errors, interventions, source artifacts, and observed outcomes. Keep credentials out of evidence.

Run these trials after packaging the final guidance:

1. **Create an extension:** a Reading List-style tool with title/URL, add/edit, read state, All/Unread filters, delete, native UI, CLI parity, reload persistence, live refresh, and two-project separation.
2. **Edit an existing extension:** add a field/action to a supplied working extension, preserve existing data, and verify the changed UI and CLI. Confirm the agent edits canonical source rather than an installed copy.
3. **Use first-party skills:** create/refine/implement dependent Planner work, write a Report, and publish an Artifact. Verify the right docs are reached, dependencies are modeled correctly, output paths are owned correctly, and resource links/opening behave as documented.
4. **Diagnose version mismatch:** first pass all workflows with aligned stable versions. Then deliberately mismatch tooling and host in a separate trial; require correct diagnosis and recovery without unsupported compatibility claims.

Pass criteria: Required operations work through public interfaces; data persists and remains project-scoped; exports contain every referenced asset; links resolve; no author needs application internals or undisclosed manual repair. Record SDK-type lookup separately from genuine dead ends. Repeat failed trials after the responsible fix with another fresh context. Do not claim a measured improvement from one agent per condition.

Before closing, all applicable CI checks must pass on each implementation PR's latest commit. Add required changesets for changed packages/extensions, release through the normal workflow, deploy the public docs, and repeat the released-package/public-site smoke journey. Keep “merged,” “released,” and “verified after release” separate. Coordinate release authority under the normal repository process.

## Reproduction starting points

Run from the repository root after `bun install --frozen-lockfile`. These are focused starting points, not a command to run every suite for every edit. Verify paths and options against the implementation commit; use only isolated runtime state.

Bare-group help regression:

```sh
doc_help_home=$(mktemp -d)
PSTDIO_HOME="$doc_help_home" PSTDIO_DISABLE_API_AUTO_START=1 \
  bun run --cwd packages/pstdio pstdio -- agents
PSTDIO_HOME="$doc_help_home" PSTDIO_DISABLE_API_AUTO_START=1 \
  bun run --cwd packages/pstdio pstdio -- agents --help
```

For the output issue, use a disposable linked project with enough installed check results to exceed 64KiB. Preserve both exit codes and parse both files; compare structure/content rather than unstable diagnostic timestamps:

```sh
set -o pipefail
pst extensions check --json > /tmp/doc-check-direct.json
pst extensions check --json | tee /tmp/doc-check-piped.json > /dev/null
bun -e 'for (const p of process.argv.slice(1)) { JSON.parse(await Bun.file(p).text()); console.log(p, Bun.file(p).size); }' \
  /tmp/doc-check-direct.json /tmp/doc-check-piped.json
```

Targeted examples and broader gates when their affected scope requires them:

```sh
bun run --cwd packages/pstdio-dashboard test src/modules/resource-links/resource-link-resolution.p0.test.ts
bun run --cwd packages/pstdio-sync-contracts test:integration
bun run --cwd clients/landing-page build
# For packaged runtime/assets changes, after the documented package build:
PSTDIO_VERIFY_PLATFORM_PKG=cli-linux-x64 bun run --cwd scripts verify:packages
```

Use [packaged auto-start tests](../../../packages/e2e/src/packaged/packaged.p1.test.ts), [runtime lifecycle tests](../../../packages/e2e/src/packaged/runtime-lifecycle.p1.test.ts), [core extension smoke checks](../../../packages/e2e/src/packaged/packaged-core-extensions-smoke.p1.test.ts), and [packaged serve checks](../../../packages/e2e/src/packaged/packaged-serve-smoke.p2.test.ts) to select the focused regression runs. Browser runs use `bun run dev:playwright` and its printed URL; stop with `bun run dev:playwright:down`. Never start the app directly or inspect its live database.

## Implementation handoff checklist

- [x] Rebaseline every finding; assign owners, dependencies, and closure checks. See the [findings register](#findings-register).
- [x] Resolve skill replacement semantics before aligning the docs and installer.
- [x] Complete public/internal/skill corrections and release-aware canonical references.
- [x] Repair reproduced runtime issues and make isolated validation repeatable. R19 waits for a timeout approval.
- [ ] Close acceptance gaps or record explicitly accepted limits with owned follow-ups. Remaining gaps are R37 to R47.
- [x] Add maintained drift checks and ownership guidance.
- [ ] Pass final fresh-agent trials with packaged skills and separate hosts. One of four trials ran (R48, R49).
- [ ] Pass applicable CI on the latest implementation commits, then record release/deployment and post-release verification separately (R36).
