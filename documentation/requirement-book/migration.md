# Requirement migration ledger

Migration source: commit `be10a274555ff00ca839539ee8c90ee5c7428ed2`, plus the local uncommitted PS-100 browser proposal. The original browser proposal in the default checkout is preserved. This ledger maps identities and dispositions only; [book.json](book.json) owns the requirements. Git retains the removed documents and their historical delivery records.

The book keeps proposed API and Cloud plans proposed, including old release-specific plans that need reconciliation. Current source does not prove release availability. Source-derived extension candidates remain proposed. Findings and qualified observations record the audit separately.

## documentation/requirements/api/0001-error-logs.md

Normative sections consolidated; old delivery observations and superseded rollout timing are historical Git evidence, not a second requirement source.

- RB 11.A.1 ← Functional Requirements
- RB 11.A.2 ← UX Requirements
- RB 11.A.3 ← Operational Requirements
- RB 11.A.4 ← Behavior
- RB 11.A.5 ← Rules & Constraints

Not carried as independent requirements: Summary; Problem; Goals; Non-Goals; Overview; Error Log Entry; Errors; Verification & Evidence; Delivery record.

## documentation/requirements/cli/0001-feedback.md

Normative sections consolidated; old delivery observations and procedural rollout details are historical Git evidence, not a second requirement source.

- RB 13.A.1 ← Missing subcommand
- RB 13.A.2 ← Unknown command or invalid arguments
- RB 13.A.3 ← Complete output

Not carried as independent requirements: PRD: CLI feedback and help; Example; Rules for new command groups; Delivery record.

## documentation/requirements/dashboard/0001-beta-features.md

Normative sections consolidated; old delivery observations and procedural rollout details are historical Git evidence, not a second requirement source.

- RB 5.A.1 ← PRD: Beta features

Not carried as independent requirements: Delivery record.

## documentation/requirements/dashboard/0003-page-titles.md

Normative sections consolidated; old delivery observations and procedural rollout details are historical Git evidence, not a second requirement source.

- RB 4.A.1 ← Requirements
- RB 4.A.2 ← Out of scope
- RB 4.A.3 ← Acceptance evidence

Not carried as independent requirements: Status; Problem and goal; Delivery record.

## documentation/requirements/dashboard/0004-sessions.md

Normative sections consolidated; old delivery observations and procedural rollout details are historical Git evidence, not a second requirement source.

- RB 3.A.1 ← Functional Requirements
- RB 3.A.2 ← UX Requirements
- RB 3.A.3 ← Operational Requirements
- RB 3.A.4 ← Behavior
- RB 3.A.5 ← Agent and Model Selection
- RB 3.A.6 ← Pages
- RB 3.A.7 ← Current Actions
- RB 3.A.8 ← Rules & Constraints
- RB 3.A.9 ← Verification & Evidence
- RB 3.A.10 ← Fork from a reply

Not carried as independent requirements: Summary; Goals; Non-Goals; Overview; Errors; Delivery record.

## documentation/requirements/dashboard/0005-settings.md

Normative sections consolidated; old delivery observations and procedural rollout details are historical Git evidence, not a second requirement source.

- RB 5.A.2 ← Settings surface
- RB 5.A.3 ← Consistent layout and pending changes
- RB 5.A.4 ← Folder requirements
- RB 5.A.5 ← Runtime settings
- RB 5.A.6 ← Extension and agent boundaries
- RB 5.A.7 ← Skills, templates, and credentials

Not carried as independent requirements: Purpose; Verification; Delivery record.

## documentation/requirements/dashboard/0006-composer-modes.md

Normative sections consolidated; old delivery observations and procedural rollout details are historical Git evidence, not a second requirement source.

- RB 3.A.11 ← Composer behavior
- RB 3.A.12 ← Visible submitted state
- RB 3.A.13 ← Plan and Goal combinations
- RB 3.A.14 ← Plans and additional information
- RB 3.A.15 ← Approving a proposed plan
- RB 3.A.16 ← Lifecycle and edge cases
- RB 3.A.17 ← Acceptance for implementation
- RB 3.A.18 ← Inline queued request editing

Not carried as independent requirements: PRD: Composer modes and provider state; Purpose; Design source; Provider findings; Delivery record.

## documentation/requirements/extensions/0001-runtime-snapshots.md

Normative sections consolidated; old delivery observations and procedural rollout details are historical Git evidence, not a second requirement source.

- RB 6.A.1 ← Required behavior
- RB 6.A.2 ← Adoption and invalidation
- RB 6.A.3 ← Failure requirements
- RB 6.A.4 ← Observability and acceptance

Not carried as independent requirements: Problem; Delivery record.

## documentation/requirements/extensions/0002-timeline-renderer.md

Normative sections consolidated; old delivery observations and procedural rollout details are historical Git evidence, not a second requirement source.

- RBE 26.A.1 ← Goal and product boundary
- RBE 26.A.2 ← Ownership
- RBE 26.A.3 ← Reusable UI contract
- RBE 26.A.4 ← Native extension view contract
- RBE 26.A.5 ← Interaction and performance requirements
- RBE 26.A.6 ← Validation and acceptance
- RBE 26.A.7 ← Out of scope

Not carried as independent requirements: PRD: Shared timeline renderer; Problem; Delivery sequence.

## documentation/requirements/platform/0001-cross-platform-support.md

Normative sections consolidated; old delivery observations and procedural rollout details are historical Git evidence, not a second requirement source.

- RB 12.A.1 ← Functional Requirements
- RB 12.A.2 ← Operational Requirements
- RB 12.A.3 ← Rules & Constraints

Not carried as independent requirements: Summary; Problem; Goals; Non-Goals; Overview; 1. Extension Execution; CI scope; Known Issues; Risks & Open Questions; Delivery record.

## documentation/requirements/platform/0002-desktop-distribution.md

Normative sections consolidated; old delivery observations and procedural rollout details are historical Git evidence, not a second requirement source.

- RB 12.A.4 ← Install
- RB 12.A.5 ← Verify a download
- RB 12.A.6 ← Updates
- RB 12.A.7 ← Update channels
- RB 12.A.8 ← Release ownership and secrets
- RB 12.A.9 ← Local runtime and account authentication

Not carried as independent requirements: PRD: Desktop distribution and updates; Release verification evidence; Release troubleshooting; Delivery record.

## documentation/requirements/platform/0003-realtime-updates.md

Normative sections consolidated; old delivery observations and procedural rollout details are historical Git evidence, not a second requirement source.

- RB 8.A.1 ← Functional Requirements
- RB 8.A.2 ← UX Requirements
- RB 8.A.3 ← Operational Requirements
- RB 8.A.4 ← Behavior
- RB 8.A.5 ← Synced Tables
- RB 8.A.6 ← Rules & Constraints

Not carried as independent requirements: Summary; Problem; Goals; Non-Goals; Overview; SSE Event Types; Errors; Delivery record.

## documentation/requirements/platform/0004-templates-and-skills.md

Normative sections consolidated; old delivery observations and procedural rollout details are historical Git evidence, not a second requirement source.

- RB 6.A.5 ← Template ownership
- RB 6.A.6 ← Skills
- RB 6.A.7 ← Migration

Not carried as independent requirements: Summary; Delivery record.

## documentation/requirements/platform/0005-versioning-and-releases.md

Normative sections consolidated; old delivery observations and procedural rollout details are historical Git evidence, not a second requirement source.

- RB 12.A.10 ← Contributor flow
- RB 12.A.11 ← Release pipeline
- RB 12.A.12 ← Done marker and recovery
- RB 12.A.13 ← Update public docs and skills after a release
- RB 12.A.14 ← Patch releases
- RB 12.A.15 ← Nightly builds

Not carried as independent requirements: PRD: Versioning and releases; Validation; One-time historical cleanup; Errors; Delivery record.

## documentation/requirements/platform/0006-resource-linking.md

Normative sections consolidated; old delivery observations and procedural rollout details are historical Git evidence, not a second requirement source.

- RB 15.A.1 ← Requirements
- RB 15.A.2 ← Acceptance
- RB 15.A.3 ← Non-goals

Not carried as independent requirements: General resource linking; Product need; Delivery; Mission test; Delivery record.

## documentation/requirements/platform/0008-resource-path-opening.md

Normative sections consolidated; old delivery observations and procedural rollout details are historical Git evidence, not a second requirement source.

- RB 15.A.4 ← Requirements
- RB 15.A.5 ← Acceptance
- RB 15.A.6 ← Non-goals

Not carried as independent requirements: Resource path opening and rich message bubbles; Product need; Schema; Delivery; Mission test; Delivery record.

## documentation/requirements/platform/0009-standardize-storage-api.md

Normative sections consolidated; old delivery observations and procedural rollout details are historical Git evidence, not a second requirement source.

- RB 7.A.1 ← Custom use cases we drop or move
- RB 7.A.2 ← Storage capacity
- RB 7.A.3 ← Attachment helper
- RB 7.A.4 ← Save outcomes
- RB 7.A.5 ← Browser file access
- RB 7.A.6 ← Data and ownership requirements
- RB 7.A.7 ← Data conversion
- RB 7.A.8 ← URLs
- RB 7.A.9 ← Planner and Reports drafts
- RB 7.A.10 ← Completion checks

Not carried as independent requirements: PRD: Standardize extension storage; What shrinks, and what does not; What becomes easier; Release plan; Proposed API; Shared files today; Map existing callers; Implementation order; Documentation to update; Dependencies; Source references.

## documentation/requirements/platform/0010-bound-client-storage-and-isolate-sync-failures.md

Normative sections consolidated; old delivery observations and procedural rollout details are historical Git evidence, not a second requirement source.

- RB 10.A.1 ← Client disk costs
- RB 10.A.2 ← 1. Define storage classes and budgets
- RB 10.A.3 ← 2. Separate synchronization from historical downloads
- RB 10.A.4 ← 3. Reclaim space without breaking recovery
- RB 10.A.5 ← 4. Amend the sync contracts first
- RB 10.A.6 ← 5. Make failures actionable
- RB 10.A.7 ← Gate 2: before eviction, compaction or budget enforcement turns on

Not carried as independent requirements: PRD: Bound client storage and isolate sync failures; Problem and release requirement; What is versioned; Failure cases; Required changes; Limits of the authoring prototype; Evidence and related contracts.

## documentation/requirements/platform/0011-simplify-extension-apis.md

Normative sections consolidated; old delivery observations and procedural rollout details are historical Git evidence, not a second requirement source.

- RB 6.A.8 ← Notification status
- RB 6.A.9 ← Final-status decision for 0.44
- RB 6.A.10 ← Session queries and shapes
- RB 6.A.11 ← Resource links
- RB 6.A.12 ← Command results, errors and streams
- RB 6.A.13 ← Settings and preferences
- RB 6.A.14 ← Saved views and renderer options
- RB 6.A.15 ← Workspace lifecycle, navigation and file links
- RB 6.A.16 ← SDK helper exports and old hook contexts
- RB 6.A.17 ← Open decisions

Not carried as independent requirements: PRD: Simplify extension APIs; Purpose and scope; What improves; Inventory and decisions; Removal inventory; Delivery and acceptance.

## documentation/requirements/platform/0012-align-extension-api-shapes.md

Normative sections consolidated; old delivery observations and procedural rollout details are historical Git evidence, not a second requirement source.

- RB 6.A.18 ← A. One webview host capability factory
- RB 6.A.19 ← B. Typed webview client
- RB 6.A.20 ← C. Context shape
- RB 6.A.21 ← D. Services with no callers
- RB 6.A.22 ← E. Naming and lookups
- RB 6.A.23 ← F. Resource and client conventions
- RB 6.A.24 ← G. Actions and when conditions
- RB 6.A.25 ← H. Form schemas
- RB 6.A.26 ← I. Collection renderer base
- RB 6.A.27 ← J. Slots
- RB 6.A.28 ← K. Events
- RB 6.A.29 ← L. Unused contracts
- RB 6.A.30 ← M. Author repetition
- RB 6.A.31 ← N. SDK public surface

Not carried as independent requirements: PRD: Align extension API shapes; Purpose and scope; Public-surface decision for 0.44; Delivery and acceptance; Not in scope.

## documentation/requirements/platform/0013-documentation-and-skills-reliability.md

Normative sections consolidated; old delivery observations and procedural rollout details are historical Git evidence, not a second requirement source.

- RBE 24.A.1 ← W1: Reconcile requirements with current behavior
- RBE 24.A.2 ← W2: Finish the verified documentation and skill corrections
- RBE 24.A.3 ← W3: Make guidance canonical and release-aware
- RBE 24.A.4 ← W4: Repair failures exposed by the workflows
- RBE 24.A.5 ← W5: Make the validation environment repeatable
- RBE 24.A.6 ← W6: Close acceptance and usability gaps
- RBE 24.A.7 ← W7: Prevent documentation and skill drift
- RBE 24.A.8 ← W8: Final fresh-agent and release gate

Not carried as independent requirements: PRD: Reliable documentation and extension authoring; Goal and scope; Evidence baseline and limits; Delivery record; Findings register; Delivery order and ownership; Reproduction starting points; Implementation handoff checklist.

## documentation/requirements/platform/0015-project-data-recovery.md

Normative sections consolidated; old delivery observations and procedural rollout details are historical Git evidence, not a second requirement source.

- RB 10.A.8 ← Outcome and boundary
- RB 10.A.9 ← Folder coverage and `.pstignore`
- RB 10.A.10 ← Ownership and encryption
- RB 10.A.11 ← Git and device-specific files
- RB 10.A.12 ← Capture and encrypted storage
- RB 10.A.13 ← Download and restore
- RB 10.A.14 ← Progress and interfaces

Not carried as independent requirements: PRD: Restore project files without a Git host; Current behavior and cause; PRD reconciliation and delivery.

## documentation/requirements/platform/0014-local-first-sync.md

R1–R60 and refined decisions retained as proposed intent; implementation evidence remains separate.

- RB 9.A.1 ← R1
- RB 9.A.2 ← R2
- RB 9.A.3 ← R3
- RB 9.A.4 ← R4
- RB 9.A.5 ← R5
- RB 9.A.6 ← R6
- RB 9.A.7 ← R7
- RB 9.A.8 ← R60
- RB 9.A.9 ← R49
- RB 9.A.10 ← R50
- RB 9.A.11 ← R51
- RB 9.A.12 ← R52
- RB 9.A.13 ← R8
- RB 9.A.14 ← R9
- RB 9.A.15 ← R10
- RB 9.A.16 ← R11
- RB 9.A.17 ← R12
- RB 9.A.18 ← R13
- RB 9.A.19 ← R14
- RB 9.A.20 ← R15
- RB 9.A.21 ← R16
- RB 9.A.22 ← R17
- RB 9.A.23 ← R18
- RB 9.A.24 ← R19
- RB 9.A.25 ← R20
- RB 9.A.26 ← R21
- RB 9.A.27 ← R22
- RB 9.A.28 ← R23
- RB 9.A.29 ← R24
- RB 9.A.30 ← R25
- RB 9.A.31 ← R26
- RB 9.A.32 ← R27
- RB 9.A.33 ← R28
- RB 9.A.34 ← R29
- RB 9.A.35 ← R30
- RB 9.A.36 ← R31
- RB 9.A.37 ← R32
- RB 9.A.38 ← R33
- RB 9.A.39 ← R34
- RB 9.A.40 ← R35
- RB 9.A.41 ← R36
- RB 9.A.42 ← R37
- RB 9.A.43 ← R54
- RB 9.A.44 ← R55
- RB 9.A.45 ← R56
- RB 9.A.46 ← R38
- RB 9.A.47 ← R39
- RB 9.A.48 ← R40
- RB 9.A.49 ← R41
- RB 9.A.50 ← R42
- RB 9.A.51 ← R43
- RB 9.A.52 ← R44
- RB 9.A.53 ← R45
- RB 9.A.54 ← R46
- RB 9.A.55 ← R53
- RB 9.A.56 ← R57
- RB 9.A.57 ← R58
- RB 9.A.58 ← R59
- RB 9.A.59 ← R47
- RB 9.A.60 ← R48
- RB 9.A.61 ← Non-goals
- RB 9.A.62 ← Acceptance
- RB 9.A.63 ← Decisions made during ticket refinement
- RB 9.A.64 ← Decisions made on 2026-10-21
- RB 9.A.65 ← Decisions made on 2026-10-30

Not carried as independent requirements: Historical architecture comparison and superseded relay design.

## documentation/guidance/0001-mission.md

Product policy moves to the canonical book; procedural guidance remains in its existing location.

- RB 1.A.1 ← 1. Purpose
- RB 1.A.2 ← 2. Who Prompt Studio is for
- RB 1.A.3 ← 3. What belongs in core
- RB 1.A.4 ← 4. Product boundaries
- RB 1.A.5 ← 5. Where the product is headed
- RB 1.A.6 ← 6. Mission test

## documentation/guidance/0002-design.md

Product policy moves to the canonical book; procedural guidance remains in its existing location.

- RB 4.A.4 ← 3. Styling rules
- RB 4.A.5 ← 4. Navigation and tabs
- RB 4.A.6 ← 5. Feedback
- RB 4.A.7 ← 6. Interaction
- RB 4.A.8 ← 7. Interface text

## documentation/guidance/0003-nonfunctional-requirements.md

Product policy moves to the canonical book; procedural guidance remains in its existing location.

- RB 14.A.1 ← 1. Scope
- RB 14.A.2 ← 2. Size and installation
- RB 14.A.3 ← 3. Performance
- RB 14.A.4 ← 4. Verification

## documentation/guidance/0006-engineering.md

Product policy moves to the canonical book; procedural guidance remains in its existing location.

- RB 7.A.11 ← 6. Extension storage

## documentation/guidance/0006-engineering.md

Product policy moves to the canonical book; procedural guidance remains in its existing location.

- RB 6.A.32 ← 7. Public extension API

## documentation/requirements/platform/0016-browser-panel-and-element-selection.md

Imported as proposed from a local untracked source; the user original is preserved outside this working branch.

- RBE 25.A.1 ← 1. Outcome
- RBE 25.A.2 ← Goals
- RBE 25.A.3 ← Initial delivery
- RBE 25.A.4 ← Deferred work
- RBE 25.A.5 ← 4. Product ownership and mission fit
- RBE 25.A.6 ← Scenario: Open an application beside a conversation
- RBE 25.A.7 ← Scenario: Keep working while changing the layout
- RBE 25.A.8 ← Scenario: Show an agent a specific element
- RBE 25.A.9 ← Scenario: Select an element in UI Canvas
- RBE 25.A.10 ← Scenario: Reuse the result outside chat
- RBE 25.A.11 ← Scenario: Agent and person inspect the same live page
- RBE 25.A.12 ← Scenario: Recover from navigation, a rebuild, or capture failure
- RBE 25.A.13 ← Browser panel
- RBE 25.A.14 ← Element selection
- RBE 25.A.15 ← Context attachment
- RBE 25.A.16 ← 9. Canvas integration
- RBE 25.A.17 ← 10. Public API and agent behavior
- RBE 25.A.18 ← 11. Lifecycle, storage, and synchronization
- RBE 25.A.19 ← 12. Capture and attachment details
- RBE 25.A.20 ← 13. Security and privacy requirements
- RBE 25.A.21 ← 14. Performance and accessibility
- RBE 25.A.22 ← Critical acceptance checks

Not carried as independent requirements: Illustrative architecture, external comparison and unvalidated design previews.

## Reconciliation boundaries

- Cloud R2 and its refined decisions govern the intended ordered-save and explicitly declared text model. Older guarded-save and retained-conflict plans remain proposed for review; they do not override the current public API contract.
- Cloud R53 owns recovery-point cadence and capacity fallback. Folder recovery under `.pstignore` is a separate proposed outcome; existing record recovery is not proof of it.
- Browser and shared timeline entries remain proposed. Their illustrative architecture and unvalidated previews are not accepted platform APIs.
- Guidance keeps contributor procedures. Product policy formerly in mission, design, performance and engineering storage/API sections now lives in the book.
- Legacy guidance references `001.S.R`, product design rules `002.S.R`, resource targets `003.S.R`, and engineering sections 6/7 map through the section headings above. Cite RB identities for new product decisions.

## Additional source details

- RB 4.A.9 ← design guidance section 1, policy scope and human authority.
- RB 11.A.6 ← API logs default-level qualification.
- RB 4.A.10 ← design guidance section 8, parameter editor.

## Review corrections

- RB 12.A.16 ← 2. Home Directory Resolution, normative Required behavior paragraph; surrounding historical implementation notes omitted.
- RB 12.A.17 ← 3. Binary Detection, normative Required behavior paragraph; surrounding historical implementation notes omitted.
- RB 12.A.18 ← 4. Path Separator Handling, normative Required behavior paragraph; surrounding historical implementation notes omitted.
- RB 12.A.19 ← 5. Signal Handling, normative Required behavior paragraph; surrounding historical implementation notes omitted.
- RB 10.A.15 ← conversion Gate 1 conditions, retained as proposed with historical release context.
- RB 9.A.66 ← Cloud Storage API change and its public deprecation boundary; proposed.

## Main integration

RB 6.A.1 carries the newer runtime-snapshot read-freshness clause from main: reads include prior invalidations; webview builds refresh later reads without invalidating the active contribution load. The superseded PRD remains removed.
