Implement ticket {{ticket}} in workspace {{workspaceId}}.

Follow the `implement-ticket` skill. Keep all work in this workspace. Commit the finished change before handoff.

After validation, create and save a change request report:

1. Run `pst reports write --kind change_request --name change_request --template change-request`.
2. Fill the returned report path with the implementation summary, decisions, tests, and anything left undone.
3. Run `pst reports save --name <returned-name>` and keep the returned `reportId`.
4. Read the workspace commit with `git rev-parse HEAD`.
5. Submit the immutable revision with:

   `pst pstdio-planner submit-change-request --workspace-id {{workspaceId}} --head-sha <head-sha> --change-request-report-id <report-id> --expected-attempt-state implementing`

If review feedback returns this session to the attempt, use `changes_requested` for `--expected-attempt-state` when submitting the next revision. Do not move the ticket status yourself. The Planner derives it from the attempt.
