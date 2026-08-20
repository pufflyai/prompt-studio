# Planner automation loops

This repository-local extension runs the Prompt Studio project's ticket automation policy.

## CLI commands

```sh
pst pstdio-planner-loops refine-tickets
pst pstdio-planner-loops implement-tickets
pst pstdio-planner-loops stuck-work-sweep
pst pstdio-planner-loops review-tickets
```

`refine-tickets` selects one eligible Backlog ticket. `implement-tickets` starts eligible TODO tickets up to the live attempt limit. `stuck-work-sweep` reconciles active managed attempts. `review-tickets` starts reviews for ready revisions.

The extension schedules the same commands. Direct CLI calls are useful for inspection and controlled manual runs.
