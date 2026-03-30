# Events and Blocking

## Session Hooks

All session hooks are non-blocking.

| Hook                       | Fires when                          | Blocking |
| -------------------------- | ----------------------------------- | -------- |
| `post-session-start`       | A session begins                    | No       |
| `post-session-success`     | A session completes successfully    | No       |
| `post-session-fail`        | A session ends with an error        | No       |
| `post-session-resume`      | A paused or crashed session resumes | No       |
| `post-session-await-input` | A session is waiting for user input | No       |

## Worktree Hooks

`pre-*` worktree hooks are always blocking.
`post-*` worktree hooks can be blocking or non-blocking, per hook.
`on-*` worktree hooks are non-blocking.

| Hook                   | Fires when                            | Blocking |
| ---------------------- | ------------------------------------- | -------- |
| `pre-worktree-create`  | Before worktree is created            | Yes      |
| `post-worktree-create` | After worktree is created             | Yes      |
| `pre-commit`           | Before staging and committing changes | Yes      |
| `post-commit`          | After a commit is created             | No       |
| `pre-rebase`           | Before rebasing onto target           | Yes      |
| `post-rebase`          | After successful rebase               | No       |
| `pre-merge`            | Before squash-merging                 | Yes      |
| `post-merge`           | After successful merge                | No       |
| `pre-worktree-remove`  | Before worktree deletion              | Yes      |
| `post-worktree-remove` | After worktree is removed             | No       |
| `on-conflict`          | When a merge or rebase hits conflicts | No       |

## Ticket Hooks

`pre-*` ticket hooks are always blocking.
`post-*` ticket hooks are non-blocking.

| Hook                        | Fires when                       | Blocking |
| --------------------------- | -------------------------------- | -------- |
| `pre-ticket-creation`       | Before a ticket is created       | Yes      |
| `post-ticket-creation`      | After a new ticket is created    | No       |
| `pre-ticket-status-change`  | Before a ticket's status changes | Yes      |
| `post-ticket-status-change` | After a ticket's status changes  | No       |
| `pre-ticket-archive`        | Before a ticket is archived      | Yes      |
| `post-ticket-archive`       | After a ticket is archived       | No       |
| `pre-ticket-deletion`       | Before a ticket is deleted       | Yes      |
| `post-ticket-deletion`      | After a ticket is deleted        | No       |
