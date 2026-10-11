# Auto Build

Auto Build automatically assigns ready tickets to your default agent while the mode is on. It applies to all eligible tickets in the project.

## Before you start

Install [Planner](../README.md#install) and [Reports](../../pstdio-reports/README.md), and open a local Git project with a usable base commit. Choose and sign in to your [default agent](../../../documentation/guides/getting-started/0004-run-agents.md).

Open **Settings → Project → Extensions → Prompt Studio Planner → Settings** to check **Maximum in-progress tickets**. The default is two, so up to two ticket implementations can run at once. Manual attempts use the same limit. A limit of zero prevents new starts.

Planner uses **Default target branch** when set, or the repository's default branch otherwise. For a local demo without a Git remote, turn off **Open PR** in these settings.

## Start Auto Build

1. Open **Project Timeline** under **Project Planning**.
2. Click **Auto Build** in the header and set **Maximum parallel tasks** in the modal. This edits the same project limit as **Maximum in-progress tickets** in Settings.
3. Confirm with the primary **Auto Build** button.

![Auto Build confirmation with its short explanation, documentation link, and primary Auto Build button.](../../../documentation/images/auto-build-confirmation.png)

Planner starts eligible **Todo** tickets across the project in timeline order. Each ticket gets its own managed Git workspace and a session with the default agent. The ticket moves to **In Progress** in both Tickets and Project Timeline.

Independent tickets can run together. A ticket waits until its prerequisites are complete and its dependency revisions are available. Blocked tickets, review gates, open requests for human input, and tickets with a current attempt do not start automatically.

## While the mode is on

Planner keeps checking for ready work. When capacity becomes available, it automatically assigns the next ready Todo ticket. Newly created tickets and tickets moved to Todo can also start when they are ready.

Auto Build keeps running when you close the timeline and resumes after restarting Prompt Studio. The selected view, filters, and search only change what you see. Auto Build always checks all eligible tickets in the project.

Implementation follows the project's Planner settings, including adversarial review and pull request creation. Auto Build starts work; it does not approve or merge it. Review the results through the normal [attempt workflow](0002-attempts.md).

## Stop Auto Build

Click **Stop Auto Build** in the timeline header to prevent further starts. Work already assigned continues and can finish. Stopping the mode does not cancel sessions or discard their changes.

The button returns to **Auto Build**. Start it again when you want to resume assigning ready work.

## When work needs attention

A launch failure turns Auto Build off and shows the error in the timeline. Resolve the problem, then start the mode again. Existing attempts stay available for inspection.

If an agent needs your help, Planner records a [review request](0006-review-requests.md) and marks the ticket **Review Needed**. Resolve the issue and answer every open request. While Auto Build is on, a paused implementation resumes in its existing session and workspace when a slot is available, with your saved answer included. Other independent work can still start when capacity allows.

If nothing starts, check that tickets are in Todo, their prerequisites are complete, the default agent is configured, and the in-progress limit has space.
