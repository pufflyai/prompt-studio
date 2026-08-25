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

Scheduled-run notifications follow one activity rule: `ctx.activity.record` means the run changed something. The host raises one notification when a run records activity and one failed notification when it fails. Quiet ticks use `ctx.logger.info`, so they stay out of the activity feed and do not notify.

When refinement completes, the loop moves the ticket to TODO and calls `pstdio-planner.request-input`. Planner reuses the completed refinement session and adds the `Awaiting Input` handoff without starting another agent run.
