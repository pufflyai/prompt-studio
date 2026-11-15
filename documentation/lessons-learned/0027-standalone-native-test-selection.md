# Standalone native checks must retain their platform assignment

The packaged-toolchain workflow passes its platform's maintained priorities in
`TEST_PRIORITIES`. Production workers consume an immutable parent plan, but a
manual full-profile dispatch uses the standalone packaged runner. That fallback
called `scripts/test.ts` without `--priority`; this command infers P0, P1 and P2
instead of reading `TEST_PRIORITIES`. A Windows ARM dispatch therefore ran P2
feature workflows outside its assigned P0/P1 workload and reported deadline
failures despite passing its assigned cases.

The fallback now validates the supplied priorities with the shared reader and
passes them explicitly. An invocation without an assignment keeps the ordinary
standalone selection. Parent-plan consumers continue to use assigned run IDs.
The real-process regression includes a different-priority fixture and proves
that both shards execute the entire assigned workload exactly once.

Standalone execution also writes structured evidence under
`test-results/ci/planned`. Upload it for manual full-profile dispatches as well
as parent-plan consumers, preserving the same attempt-specific names, source
identity and fixture exclusions. Runtime logs and screenshots alone cannot
establish complete case execution. Keep extra diagnostic failures in the report;
do not describe out-of-assignment results as a passing full run or change test
limits to make them pass.

The [CI stage policy](../guides/development/0015-ci-stages.md) owns platform and
priority membership. Workflow defaults and ad hoc filename filters must not
replace it.
