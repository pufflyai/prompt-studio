# Agent-owned Planner progress

Proposed: 2026-10-13

Status: Accepted for PS-709 and PS-690.

## Context

Planner attempt states and the derived managed ticket status duplicate ticket progress, session execution, and review evidence. Their transition gates prevent later revisions after a passing review and lead agents to launch a second mandatory review. Editable status labels also change dependency, merge, notification, and Timeline behavior.

## Decision

The responsible implementation agent maintains ticket progress through existing ticket commands. A person can override it. Planner attempts retain implementation variants, workspace/session ownership, submitted revisions, and commit-bound review evidence. They have no stored progress lifecycle. Reuse one linked workspace and conversation for normal work and corrections; create another for an explicit implementation alternative.

Project workflow settings own explicit completed, blocked, active, and optional merge-destination status IDs. Empty selections disable their convenience. Labels, seed IDs, icons, and ordering do not assign meaning. Auto Build owns eligible filters, the supervisor model, the supervisor's saved scope queries, capacity, and prerequisite policy. Eligible filters govern new work; started work can continue after its agent changes the ticket status. Dependency closure supplies context, not dispatch authority.

Submission and optional review commands share a workspace write guard. They validate ownership, saved reports, exact Git heads, and dependency ancestry. Reviews record evidence without moving tickets or automatically starting another implementation. The implementation skill performs the normal adversarial review.

Auto Build observes relevant execution, requests, submitted heads, dependency heads, and PR/check evidence. It resumes the current owner for unfinished work, stack repair, and PR or CI repair. A queued message preserves ownership. No command transfers a live branch to a competing writer. A known unexpected exit permits one recovery in the same conversation. An explicit user stop stays stopped.

Auto Build stores one run state: running, paused, or stopped. Pause gates dispatch and wake-ups while current agents finish. Resume retains the same supervisor and scope with a fresh revision. Stop is available while paused and waits for in-flight ownership records before cancelling linked supervisor, implementation, review, repair, and request conversations. A cancellation failure leaves the run paused for retry. Unrelated manual sessions are not cancelled.

Timeline presentation choices belong to the project preferences. Passed and completed milestones are shown by default. Hiding completed milestones uses the full milestone's ticket progress before search or ticket filters. Collapsed tracks and milestones survive reloads and saved-view changes.

Core persists actual execution exits in the existing activity table in the terminal status transaction. The SDK exposes latest-run evidence. No database schema change is needed. Planner consumes these facts without owning generic execution.

## Upgrade and public contracts

One resumable extension-storage migration backs up legacy attempt records, preserves revisions and links, and backfills missing retirement events. It changes no ticket status and starts no sessions. Legacy Auto Build modes without eligible statuses remain stopped until configured. Stop old Planner writers before upgrading; version-two writes cannot recreate lifecycle fields.

State-free `submit-revision` and `list-variants` contracts are additive. Legacy command results retain a deprecated evidence-only state projection. Deprecated state parameters are accepted but do not gate commands. Remove those contracts together in the next coordinated breaking release. The SDK exit member is optional and follows the additive API version step.

## Trade-offs

Agents must keep ticket progress current. Configuration requires explicit user choices. Unknown historical exits cannot be safely recovered automatically. Git ancestry and verified squash-merge provenance remain required; patch similarity cannot establish prerequisite completion. Missing or unavailable evidence stays visible with a concrete next action.
