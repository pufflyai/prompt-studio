# Responsive extension delivery

This is the implementation split for [ADR 0117](../../adrs/0117-explicit-extension-runtime-ownership.md). All rows are planned. No runtime work starts until the architecture is agreed. Merging an early PR does not complete the [PRD](../../requirements/platform/0015-responsive-extension-execution-and-builds.md) or enable process owners by default.

## Branch and review policy

Use current `main` as the base for each independent PR. Stack only when a real unreleased dependency requires it, and state that dependency. Do not stack new work on broad [draft #1475](https://github.com/pufflyai/prompt-studio/pull/1475). Preserve that draft as experimental evidence until useful changes are extracted; do not merge it wholesale or mechanically cherry-pick its entire runtime. The additional local preparation checkpoint is also unreviewed source material.

Each implementation PR must describe its one boundary, excluded surfaces, prerequisite releases and passing evidence. Reconsider extracted code against the accepted architecture, remove obsolete pilot paths, and keep the existing public API available during its deprecation period. Changesets and extension API versioning follow the repository rules. Independent extension adoption follows the published SDK release, not a root-workspace-only type pass.

## PR sequence

These are review units, not new runtime statuses or a promise to fit unrelated work into one PR. A repeated provider or surface migration gets its own PR.

| ID | Review unit and dependency | Concrete acceptance evidence | Deliberately excluded |
| --- | --- | --- | --- |
| D0 | This ADR, PRD and delivery plan. | Review the ownership, publication, API migration, cancellation and authentication decisions together. Documentation links pass. | All runtime changes. |
| P1 | Recreated fixed-workload fixtures and reports, after D0. | Reproduce checksum, initialization through actual Reload, six-view build/edits, invalid/repair and unchanged-save controls. Keep paired order, fixture/source hashes, all samples and failed-run traces. Record recreation provenance. | Production owner protocol and policy. |
| P2 | Compiler supersession, staging and reaping, after D0; use P1 evidence. | Real watcher test for overlapping edits; cancel queued obsolete work before spawn; reap unneeded active compilers before releasing resources; publish matching output/signature atomically; invalid/repair retains working output. Cover shared-source consumers, disable/remove and shutdown. Native packaged compiler smoke passes. | Backend adoption and adaptive admission. |
| P3 | Trusted source preparation off the API loop, after D0. | Real metadata/hash/dependency preparation preserves source resolution and cancellation, catches same-size edits, and does not import author entry code in the API. Private staging is cleaned. Compare unrelated API progress and packaged entry/dependency behavior. | Adopting a prepared candidate or adding owner-side public API proxies. |
| P4 | Runtime registry references and supervisor, after D0. | Candidate, snapshot, invocation, result and provider references have acquire/release tests. Repeated generations return process/handle counts to live references. Test shared projects, import loop/exit, final-reference reaping, Stop/Restart races and immutable-artifact restart. Packaged source-owner entry works. | Broad callback migration, production policy constants and default rollout. |
| P5 | One complete command path and its typed capabilities, after P3/P4. | Real API, PGlite, command validation/middleware, storage result/error parity; correct project/instance/workspace under overlap; accepted writes during exit; one-slot nested calls; backpressured streams and deterministic release. API never imports the covered entry first. Unsupported surfaces are diagnosed before selecting the isolated path. | Claiming harness/terminal compatibility or automatic fallback after owner failure. |
| P6 | Guarded catalog publication and scoped retirement, after P3/P4/P5. | Reload races edits, enablement, disable/uninstall and commit; changed indexes drain old uses; unchanged definitions let accepted commands finish; no mixed handlers/definitions on commit failure or uncertainty. Failed candidates preserve working state. Asset-only changes keep provider identity. Test requesting-project adoption separately from other projects. | A second catalog or per-generation index system. |
| P7 | Additive async harness event contracts and host adapters, after D0; publish before extension adoption. | New types cover start/resume/reattach and prepared operations. Host sequence proves push acknowledgment, read barrier, concurrent host writes, question/reply ordering, final-done ordering, bounded cancellation and loss/uncertainty. Existing synchronous providers keep their current behavior. | Owner support via stale synchronous projections or changing old methods to return promises. |
| P8 | One real Codex lifecycle on the owner protocol, after P6/P7 and native account release. | Use native sign-in and stable native account storage. Prove start/events/question/steer/cancel/done, idle release, source Reload drain, scoped disable, shared native transport ownership, authentication disconnect and shutdown against the public APIs. Native packaged execution and negative secret-inheritance checks pass. | Environment-key delegation and migrating every harness together. |
| P9 | Remaining public surface migrations, one coherent family per PR, after P5/P6. Harness providers also depend on P7/P8. | Maintain the coverage table below. Each family proves old/new result and lifetime parity with a real core extension, migration documentation, package smoke and applicable SDK release. Complete terminal async open, workspace/provider callbacks and remaining stream/value codecs. | Turning on default isolation while any supported entry/callback still runs on the API. |
| P10 | Complete resource attribution, after P2/P4/P5; session coverage follows P8. | Observe resident and retained versions, background activity, direct children and host-launched managed children. Charge physical processes once. Show missing metrics, detached exceptions and sampler cost. Repeated Reload/session cleanup returns resources to live references on native platforms. | Calibrated admission, hard CPU quota claims or killing accepted writes. |
| P11 | Shared resource admission and measured policy, after P1/P2/P6/P9/P10. | Commit the measured policy table required by ADR 0117. Real one/two/four-CPU, quota/affinity disagreement, low-memory and larger-host cases prove zero-fit waiting, bounded bytes/counts, deadlines, fair dispatch, one-slot nesting and cancel/reap accounting. Compare completion and latency with unchanged controls. | Enabling unmeasured pilot constants or raising existing limits. |
| P12 | Public operation progress and recovery, after the relevant command/build/session control contracts. Split API/SDK publication and client adoption if needed. | Dashboard, CLI and agents use the same progress/cancellation outcomes. Shared-owner Stop shows current impact and reaping outcome. Waiting Reload explains retained working state. Accessible stories and isolated Playwright prove cancel/retry, backend disconnect, reconnect backoff and draft retention. | User-facing scheduler tuning or independent polling owners. |
| P13 | Default migration and release qualification, after every applicable row above. | Complete PRD acceptance matrix and installed-user walkthroughs, published SDK/core extension adoption, native packaged matrix, repeat-generation memory evidence and named hardware budgets. Demonstrate rollback retaining adopted source/data. All applicable checks pass on the release candidate. | Unsupported authentication deployments or any automatic inline fallback. |

P2 and P3 are independent useful improvements. P7 can be reviewed separately from process implementation. P4 alone is internal lifetime groundwork; it is not a production command path. P10 observes resources before P11 makes admission decisions. P12 should accompany each newly usable operation, rather than leave recovery to a final bulk UI PR.

## Public surface coverage

P5 starts this inventory with the concrete operations it supports. P9 completes it. A row moves to covered only with its actual callback/codec list, reference owner, release paths and linked tests; a generic RPC test does not cover an entire family.

| Family | Required scope |
| --- | --- |
| Source evaluation and descriptors | Discovery, install, update, Reload, development adoption, author validation, schemas/normalization, dependency resolution and packaged entry selection. |
| Commands and behavior | Parameter validation, results, middleware, hooks/events, schedules, setup/migration callbacks, cancellation, nested calls and streams. |
| UI and contribution callbacks | Renderers, dynamic options/settings, menus/navigation, resource/hierarchy providers and every other executable contribution in `ExtensionDefinition`. Static data is distinguished from author callbacks. |
| Host context | Every `ExtensionContextBase` API, including deprecated supported storage APIs, file mounts/bytes, Blob uses if public, pure factories/helpers, session creation, workspace context and logging/navigation ordering. |
| Workspaces and processes | Workspace provider methods and execution targets, run-to-completion processes, declared detached behavior, terminal creation, ordered I/O, exit and close. |
| Harnesses | Detection/models/capabilities, account flow, start/resume/reattach, native history/recovery, prepared commands, questions, approvals, steering, done, idle release and provider disposal. |
| Ownership paths | Shared installed copies, host-wide discovery scope, project scope, workspace changes, accepted old generations, failed candidates, Stop/Restart, disable/uninstall and shutdown. |

## PRD acceptance ownership

| Acceptance cases | Primary PRs | Release qualifier |
| --- | --- | --- |
| A1–A5: progress, I/O, scope, failure and nesting | P4/P5/P10/P11 | Real storage, scopes and accepted-write uncertainty; no fixture-only adapter. |
| A6–A8: correct and reclaimed builds | P1/P2 | Real watcher and compiler; record obsolete spawns/cancels and emitted revisions. |
| A9–A10: actual Reload and publication races | P3/P6 | Commit ordering and metadata/handler consistency under source/enablement changes. |
| A11: active harness lifecycle | P6/P7/P8 and each P9 provider | Asset edits preserve active work; backend adoption waits for retirement or explicit cancellation. |
| A12: constrained admission | P10/P11/P12 | Measured policy, bounded waits, fairness and resource return. |
| A13: disconnect and drafts | P12 | Existing connection owner and reconnect behavior; no mutation replay. |
| A14: cleanup | P2/P4/P6/P8/P9/P10 | Every managed reference settles and reaps; deliberate `spawnDetached` exception remains explicit. |
| A15: native packaging | Every runtime PR; final P13 | Required supported CLI/desktop targets. Source-mode and one native OS are insufficient. |
| A16–A17: background loops, initialization and children | P4/P5/P8/P10/P11/P12 | Host Stop stays reachable, shared effects are reported, managed children are included and cleanup is confirmed. |

## Evidence and release blockers

The original experiment files were missing. The requester authorized recreating them. The experimental branch records that provenance and actual fixture density; retain it in P1. Do not present the recreated fixtures as byte-identical historical files.

Existing [experimental PR #1475](https://github.com/pufflyai/prompt-studio/pull/1475) has useful macOS and Linux measurements and some native source-mode passes. Its [full native run](https://github.com/pufflyai/prompt-studio/actions/runs/40386474298) still has unresolved packaged failures. Those results neither qualify a new extraction commit nor justify assuming all failures are unrelated. Each extracted runtime PR owns its relevant new checks.

The supplied four-CPU/16-GiB Linux reference gate is still required. Existing 6-GiB Docker measurements are a different profile. Keep all fixed workload sizes, budgets and execution allowances unchanged unless the requester separately approves an exact change. Do not rerun full application tests for this documentation-only PR.

Authentication through inherited backend environment keys is outside this split. P13 cannot migrate deployments that require it until native sign-in provides an approved supported migration or a separate credential-delegation ADR and capability ship. Sharing a source process also shares failure impact; independent hard cancellation needs a process-granularity decision, not another transport patch.

The runtime pause ends only when ADR 0117 is agreed. Later PR boundaries may get smaller after review; they must not silently expand around an unresolved contract.
