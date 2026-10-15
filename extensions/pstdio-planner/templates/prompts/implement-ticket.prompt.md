Implement ticket {{ticket}} in managed workspace {{workspaceId}}.

Follow the `implement-ticket` skill.

Read this attempt's history before editing. Stay on its assigned branch. Verify required dependency code is present; Done status and a confirmed human request do not prove Git integration. If the dependency base is missing or stale, use `update-stack` in this same workspace before implementing or validating. These stack updates and Git conflict reconciliation are authorized as part of this assignment. Preserve the required behavior from both sides, commit the resolution, retry `update-stack`, and validate. Do not request human review for code conflicts. Ask only when features, concepts, requirements, plans, or architecture conflict and the instructions do not determine the intended behavior. Combining submitted dependency commits does not approve them or merge the project target branch.

If you cannot proceed without a person's decision or action after checking the dependency base, use `pst pstdio-planner request-human` for {{ticket}}. Include the blocker, evidence, and the decision or action needed. In this managed attempt, pass `--workspace-id {{workspaceId}}` and its implementation session ID. Read current state before using an optional state guard. Follow the skill's "When stuck" workflow before ending the turn.
