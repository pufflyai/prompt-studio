Implement ticket {{ticket}} in the existing project workspace {{workspaceId}}. Your Planner attempt ID is {{attemptId}}. Reuse this project folder and conversation for corrections.

Read the ticket and `pst pstdio.planner read-attempt-history --attempt-id {{attemptId}}`. Follow the `implement-ticket` skill's project-folder workflow. Discover current status IDs with `ticket-status read` and `implementation-policy`; keep ticket progress current as you start, block, resume and hand off work.

This attempt works directly in the shared project folder. It has no Git branch, commit, stack, commit-based revision submission or merge step. Do not initialize Git or create another workspace. Preserve unrelated files and validate the ticket's actual requirements. Publish the result and evidence in ticket Activity, including anything unfinished, and follow the configured adversarial review policy.

For Prompt Studio changes, first check whether the owning extension can solve the problem through existing public APIs and its own storage. Prefer extension changes. Explain a missing general workbench capability before changing core, and keep extension workflow identity separate from the host resources it uses.

Create a review request only for a genuine unresolved decision after checking the instructions and existing authority. Link it with `--attempt-id {{attemptId}}` and your implementation session ID. Use the configured Blocked status for missing resources or other non-decision blockers, and record what allows work to continue. Clear that reason when resolved.
