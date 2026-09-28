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

- Keep tabs on one row. When they no longer fit, shrink them to a minimum width of 48 px per tab, including padding and controls.
- Keep icons and the active tab's close button at their normal size. Give the label the remaining space and truncate it using the rule above.
- Once all tabs reach 48 px, scroll the tab strip horizontally. Do not shrink tabs further or wrap them onto another row.
- Scroll the active tab fully into view when a tab is opened or selected, including when closing a tab selects its neighbor.

## Banners

- Show a banner only when the user can act on it. The product recovers from internal problems, such as saved and agent history that disagree, on its own and shows no banner.
- Every banner has a close button. Closing hides that message; a new failure shows its own banner.
- Offer Retry only for a temporary failure, one that can succeed on a later try: no response, a server error (5xx), a timeout (408), or rate limiting (429). A permanent failure, such as a missing session (404), shows no Retry.
- Use `AlertMessage` with `layout="banner"`, `endElement` for Retry (a `2xs` outline button), and `onClose` for the close button. Banners span their panel edge with square corners; inline alerts keep the alert radius.
- Chat banners:
  - "Could not load conversation" (error): Retry reconnects the conversation.
  - "Could not update queued prompts" (warning): Retry reloads the queued prompts.
  - The server reports a failure to read the queue as temporary.
- Error parts inside the conversation and failed tool calls are part of the conversation, not banners. They have no close or retry action.

## Motion experiments

- Explore animation proposals in [Motion Lab](motion/README.md), with source studies in `design/motion` and a review extension in the project sidenav.
- Lab timings remain proposals until visual review. Commit approved rules here, then implement them in shared UI and Storybook.
