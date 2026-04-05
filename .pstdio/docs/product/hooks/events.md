# Events and Blocking

All hooks are dispatched via SDK plugins (`definePlugin` in `.pstdio/plugins/`). Handlers receive a typed context object.

## Session Hooks

All session hooks are non-blocking. Dispatched via plugins.

| Hook                       | Fires when                          | Blocking | Dispatch |
| -------------------------- | ----------------------------------- | -------- | -------- |
| `post-session-start`       | A session begins                    | No       | Plugin   |
| `post-session-success`     | A session completes successfully    | No       | Plugin   |
| `post-session-fail`        | A session ends with an error        | No       | Plugin   |
| `post-session-resume`      | A paused or crashed session resumes | No       | Plugin   |
| `post-session-await-input` | A session is waiting for user input | No       | Plugin   |

## Worktree Hooks

All worktree hooks are dispatched via plugins.

`pre-*` hooks are always blocking.
`post-*` hooks can be blocking or non-blocking, per hook.
`on-*` hooks are non-blocking.

| Hook                   | Fires when                            | Blocking | Dispatch |
| ---------------------- | ------------------------------------- | -------- | -------- |
| `pre-worktree-create`  | Before worktree is created            | Yes      | Plugin   |
| `post-worktree-create` | After worktree is created             | Yes      | Plugin   |
| `pre-commit`           | Before staging and committing changes | Yes      | Plugin   |
| `post-commit`          | After a commit is created             | No       | Plugin   |
| `pre-rebase`           | Before rebasing onto target           | Yes      | Plugin   |
| `post-rebase`          | After successful rebase               | No       | Plugin   |
| `pre-merge`            | Before squash-merging                 | Yes      | Plugin   |
| `post-merge`           | After successful merge                | No       | Plugin   |
| `pre-worktree-remove`  | Before worktree deletion              | Yes      | Plugin   |
| `post-worktree-remove` | After worktree is removed             | No       | Plugin   |
| `on-conflict`          | When a merge or rebase hits conflicts | No       | Plugin   |

## Ticket Hooks

All ticket hooks are dispatched via plugins.

`pre-*` ticket hooks are always blocking.
`post-*` ticket hooks are non-blocking.

| Hook                        | Fires when                       | Blocking | Dispatch |
| --------------------------- | -------------------------------- | -------- | -------- |
| `pre-ticket-creation`       | Before a ticket is created       | Yes      | Plugin   |
| `post-ticket-creation`      | After a new ticket is created    | No       | Plugin   |
| `pre-ticket-status-change`  | Before a ticket's status changes | Yes      | Plugin   |
| `post-ticket-status-change` | After a ticket's status changes  | No       | Plugin   |
| `pre-ticket-archive`        | Before a ticket is archived      | Yes      | Plugin   |
| `post-ticket-archive`       | After a ticket is archived       | No       | Plugin   |
| `pre-ticket-deletion`       | Before a ticket is deleted       | Yes      | Plugin   |
| `post-ticket-deletion`      | After a ticket is deleted        | No       | Plugin   |

## Attempt Status Hooks

All attempt-status hooks are dispatched via plugins.

| Hook                          | Fires when                      | Blocking | Dispatch |
| ----------------------------- | ------------------------------- | -------- | -------- |
| `pre-attempt-status-change`   | Before attempt status changes   | Yes      | Plugin   |
| `post-attempt-status-change`  | After attempt status changes    | No       | Plugin   |
