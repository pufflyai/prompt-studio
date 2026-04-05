# Events and Blocking

All hooks are dispatched via SDK plugins (`definePlugin` in `.pstdio/plugins/`). Handlers receive a typed context object.

## Session Hooks

All session hooks are non-blocking.

| Hook                     | Fires when                          | Blocking |
| ------------------------ | ----------------------------------- | -------- |
| `postSessionStart`       | A session begins                    | No       |
| `postSessionSuccess`     | A session completes successfully    | No       |
| `postSessionFail`        | A session ends with an error        | No       |
| `postSessionResume`      | A paused or crashed session resumes | No       |
| `postSessionAwaitInput`  | A session is waiting for user input | No       |

## Worktree Hooks

Pre-hooks are blocking. Post-hooks and `onConflict` are non-blocking.

| Hook                  | Fires when                            | Blocking |
| --------------------- | ------------------------------------- | -------- |
| `preWorktreeCreate`   | Before worktree is created            | Yes      |
| `postWorktreeCreate`  | After worktree is created             | No       |
| `preCommit`           | Before staging and committing changes | Yes      |
| `postCommit`          | After a commit is created             | No       |
| `preRebase`           | Before rebasing onto target           | Yes      |
| `postRebase`          | After successful rebase               | No       |
| `preMerge`            | Before squash-merging                 | Yes      |
| `postMerge`           | After successful merge                | No       |
| `preWorktreeRemove`   | Before worktree deletion              | Yes      |
| `postWorktreeRemove`  | After worktree is removed             | No       |
| `onConflict`          | When a merge or rebase hits conflicts | No       |

## Ticket Hooks

Pre-hooks are blocking. Post-hooks are non-blocking.

| Hook                      | Fires when                       | Blocking |
| ------------------------- | -------------------------------- | -------- |
| `preTicketCreation`       | Before a ticket is created       | Yes      |
| `postTicketCreation`      | After a new ticket is created    | No       |
| `preTicketStatusChange`   | Before a ticket's status changes | Yes      |
| `postTicketStatusChange`  | After a ticket's status changes  | No       |
| `preTicketArchive`        | Before a ticket is archived      | Yes      |
| `postTicketArchive`       | After a ticket is archived       | No       |
| `preTicketDeletion`       | Before a ticket is deleted       | Yes      |
| `postTicketDeletion`      | After a ticket is deleted        | No       |

## Attempt Status Hooks

| Hook                        | Fires when                    | Blocking |
| --------------------------- | ----------------------------- | -------- |
| `preAttemptStatusChange`    | Before attempt status changes | Yes      |
| `postAttemptStatusChange`   | After attempt status changes  | No       |
