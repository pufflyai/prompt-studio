# Common design patterns

**Human-editable only.** Agents must read and follow this file. Agents must not edit it unless a human explicitly requests changes to this file.

Use these general UX and UI patterns across the app and its extensions.

## Hover

- Show hover feedback immediately when the pointer enters.
- Delay hover exit by 150 ms so controls do not flicker as the pointer moves. Use the same timing across shared components.
- Keep revealed controls visible while the pointer or keyboard focus is inside them. Cancel a pending exit when the pointer returns.
- Make hover actions available through keyboard focus and touch too.

## Tooltips

- Show hover styling immediately. Wait 300 ms before opening an explanatory tooltip.
- Show tooltips on keyboard focus too. Use the same tooltip text for pointer and keyboard users.
- Position tooltips outside their trigger so they do not cover it.

## Status bar

- Use color only when something needs attention. Normal states use muted text.
- Put app-wide indicators at the trailing end.
- Center status items vertically in the bar.

## Form controls

- Use small inputs and buttons in dialogs and settings.
- Use extra-small inputs for inline file creation and renaming in the side navigation.
- Inputs and buttons in the same row must have matching heights. Use shared component sizes.

## Delete icon buttons

- Use the same style as the Statuses editor for every delete icon button in the app and its extensions.
- Use `fg.subtle` on a transparent background at rest. Use `fg.error` and `bg.error` on hover, keyboard focus, and press. A row that reveals its delete action on hover uses the same colors.
- Keep disabled delete buttons subdued, with no error-colored hover state.
- Use the shared button recipe's `destructive-ghost` variant. Keep the size appropriate for the surrounding controls.
- This rule applies to icon-only delete and trash actions. Text delete buttons and close or dismiss buttons keep their own styles.

## Long paths and resource names

- Truncate in the middle. Keep the beginning and the final 3–5 characters visible, including the file extension when possible.
- Use one ellipsis, for example `project…n.ts` or `/Users/alex/…ssets`.
- Make the full value available on hover and keyboard focus. Copy actions must copy the full value.

## Backend connection

- Show an amber Reconnecting indicator in the trailing status bar while the backend connection is lost.
- Explain the connection loss and automatic retry in a tooltip available on hover and keyboard focus.
- Keep loaded navigation visible. Connection failures do not show a view error banner.
- Remove the warning when live sync reconnects. Ordinary view failures still show their error notice.

## Tabs

- A main view that supports only one resource has no close action or tab strip. Selecting another resource replaces its content.
- A main view that supports multiple open resources keeps its tab strip and close action even when only one resource is open.
- Keep tabs on one row. When they no longer fit, shrink tabs that have a close button to a minimum width of 48 px per tab, including padding and controls.
- Tabs without a close button, such as saved view tabs, keep their content width. Only their label cap truncates them.
- Keep icons and the active tab's close button at their normal size. Give the label the remaining space and truncate it using the rule above.
- Project tabs stop at 64 px because they always show a close button.
- Once all shrinking tabs reach their minimum, scroll the tab strip horizontally. Do not shrink tabs further or wrap them onto another row.
- Scroll the active tab fully into view when a tab is opened or selected, including when closing a tab selects its neighbor.

- Put + immediately after the scrolling tab group and keep it visible. Reserve the far-right corner for panel menu openers.
- Normal click selects. Right-click, Shift+F10, the Context Menu key, and touch long-press open one grouped context menu with contributed actions above shared tab actions.
- Pinning changes preview retention and never changes horizontal order. Pinned and preview tabs may be interleaved.
- Use the shared Sidenav placement indicator, rotated vertically, between tabs. Headerless panels show a temporary top drop band during a valid drag without moving their content. After a drop, show the tray for the existing content and the moved tab.

## Command failures

- Report a command failure once, where the user started it. Dialogs and renderer reads show failures inline. Actions without an inline display use the shared action reporter.
- The command transport forwards outcomes and notices. It does not report failures.

## Problems in the chat

- Show problems in the conversation, where the user is looking, with consistent error styling. Do not use banners.
- Show a problem only when the user can act on it. Recover from internal problems without interrupting the user.
- Give actionable problems a close button. Offer Retry only when another attempt can succeed, such as after a connection failure or a temporary service problem.
- Show sent messages immediately. If sending fails, keep the message visible and clearly mark it as unsent. Retry sends it again. Closing the problem restores the message text and attachments to the input so the user loses nothing.
- Show conversation loading problems at the end of the conversation, with a retry action when appropriate.
- Closing a problem hides that message. A new failure shows its own problem.
- Keep agent errors and failed tool calls in the conversation history, without close or retry actions.

## Sidenav levels

A page can have its own navigation tree. Opening that page replaces the project navigation with the page's navigation. Begin its breadcrumb with the project so the user can return to the project level.

- The project crumb shows the project avatar and title, like the project button in the browser navbar.
- The project crumb, a click on the already active project tab on desktop, and the project button in the browser navbar all open the last root-level page the user visited in this project.
- A page with its own navigation is a level page. Its containing project page is the root-level page.
- A mode with its own navigation follows the same rule. Its breadcrumb includes the project, and the project button leaves the mode.
- Moving from one level to another, such as Sessions to Notes, keeps the saved page. It also survives a reload.
- The Start page is only the fallback, used when no root-level page has been visited yet.
- A click on the active project tab on a root-level page does nothing.
- Do not add a Back row to the side navigation when back and forward buttons already appear in the navigation bar.

## Activity

- Show work in progress with a spinner or the elapsed time. Never animate text: no shimmer, gradient sweeps, or pulsing labels. Moving text is harder to read and looks like an effect rather than status.
- When the work finishes, keep its duration visible, for example "Worked for 7s".
