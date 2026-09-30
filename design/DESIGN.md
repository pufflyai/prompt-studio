# Common design patterns

Read this file before working on UI or design. Use these patterns across the app and its extensions. Pencil defines visual styles; Storybook documents component APIs and props.

## Hover

- Show hover feedback immediately when the pointer enters.
- Delay hover exit by 150 ms so controls do not flicker as the pointer moves. Use the same timing across shared components.
- Keep revealed controls visible while the pointer or keyboard focus is inside them. Cancel a pending exit when the pointer returns.
- Make hover actions available through keyboard focus and touch too.

## Tooltips

- Show hover styling immediately. Wait 300 ms before opening an explanatory tooltip.
- Show tooltips on keyboard focus too. Use the same tooltip text for pointer and keyboard users.
- Position tooltips outside their trigger so they do not cover it.

## Form controls

- Use (`sm`) inputs and buttons in dialogs and settings.
- Use (`xs`) inputs for inline file creation and renaming in the Sidenav.
- Inputs and buttons in the same row must have matching heights. Use the shared `size` prop instead of local height overrides.

## Long paths and resource names

- Truncate in the middle. Keep the beginning and the final 3–5 characters visible, including the file extension when possible.
- Use one ellipsis, for example `project…n.ts` or `/Users/alex/…ssets`.
- Make the full value available on hover and keyboard focus. Copy actions must copy the full value.

## Tabs

- A Main view that supports only one resource has no close action or tab strip. Selecting another resource replaces its content.
- A Main view that supports multiple open resources keeps its tab strip and close action even when only one resource is open.

- Keep tabs on one row. When they no longer fit, shrink tabs that have a close button to a minimum width of 48 px per tab, including padding and controls.
- Tabs without a close button, such as saved view tabs, keep their content width. Only their label cap truncates them.
- Keep icons and the active tab's close button at their normal size. Give the label the remaining space and truncate it using the rule above.
- Project tabs stop at 64 px because they always show a close button.
- Once all shrinking tabs reach their minimum, scroll the tab strip horizontally. Do not shrink tabs further or wrap them onto another row.
- Scroll the active tab fully into view when a tab is opened or selected, including when closing a tab selects its neighbor.

## Problems in the chat

- The chat has no banners. A problem appears in the conversation, where the user is looking, styled like an agent error (`AlertMessage`, `status="error"`).
- Show a problem only when the user can act on it. The product recovers from internal problems, such as saved and agent history that disagree, on its own.
- Every problem has a close button (`onClose`). Offer Retry (`endElement`, a `2xs` outline button) only for a temporary failure, one that can succeed on a later try: no response, a server error (5xx), a timeout (408), or rate limiting (429). A permanent failure, such as a missing session (404), shows no Retry.
- A message the user sends appears in the conversation right away. If it cannot be sent, it stays there, dimmed and marked "Not sent", followed by "Message not sent". Retry sends it again. Close removes it and puts its text and attachments back in the composer, so nothing the user typed is lost.
- Other chat problems appear at the end of the conversation:
  - "Could not load conversation": Retry reconnects the conversation.
  - "Could not update queued prompts": Retry reloads the queued prompts. The server reports a failure to read the queue as temporary.
- Closing a problem hides that message; a new failure shows its own problem.
- Error parts from the agent and failed tool calls are part of the conversation and have no close or retry action.

## Motion experiments

- Explore animation proposals in [Motion Lab](motion/README.md), with live project studies in `design/motion/studies` and a review extension in the project sidenav.
- Lab timings remain proposals until visual review. Commit approved rules here, then implement them in shared UI and Storybook.
