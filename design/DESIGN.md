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

## Menus

- Show a selected menu item's checkmark at the far right. Keep its icon and label together at the left.
- Selection never changes a menu item's background. Hover and keyboard focus use the same feedback on selected and unselected items.
- This rule applies to checkbox, radio, searchable, and plain selection menus. Tree items and navigation keep their own selected backgrounds.
- Use shared menu rows for actions such as Reset layout. Keep the action icon beside its left-aligned label.

## Workbench drag and drop

- Reveal a filled cover only over the valid destination under the dragged item. Do not show every panel target when a drag starts.
- Cover the destination area. Do not draw an accent outline around it. Tab insertion uses the shared thin insertion indicator instead of a panel cover.
- Closed page side and bottom panels accept drops before they have ever been opened. Their invisible hit areas remain available during a valid drag.
- Show one destination at a time where page and mode edges meet. The outer mode edge takes priority; page targets remain reachable inside it.
- Bubble dragging shows its eight anchor targets. Use a filled background for the nearest target, with no accent outline, and keep the dragged bubble attached to the pointer without flicker.
- The floating panel covers the launcher's position when it opens. Hide the launcher while the floating panel is open and restore it when the panel closes.
- Navigation has no added panel title header. Keep the Main and page-side tab headers visually continuous: no divider between their headers and no top border on the page-side header. A content divider may start below the headers.

See the drag-and-drop examples in [the Pencil design system](prompt-studio-design-system.pen).

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

## Direct UI actions

- Prefer optimistic updates for direct UI actions. Show the intended change immediately while saving it.
- Keep navigation, tabs, breadcrumbs, and content consistent during the save. Do not flash an older snapshot while refreshing.
- If saving fails, restore the affected state and report the failure where the action started. Preserve newer user actions.
- Confirm destructive actions before applying the optimistic change.

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

- Show work in progress with a spinner or the elapsed time. Never animate status text: no shimmer, gradient sweeps, or pulsing labels. Moving text is harder to read and looks like an effect rather than status. Newly streamed response text may fade once, as described below.
- When the work finishes, keep its duration visible, for example "Worked for 7s".

## Motion

Use the shared `@pstdio/ui` motion tokens and recipes. These values adopt the Navigation tree, Panels, Floating panel, and Streaming Motion Lab studies at their Subtle setting. Do not add a JavaScript animation library.

| Motion | Enter | Exit |
| --- | --- | --- |
| Tree children and chevrons | 160 ms | 120 ms |
| Sidenav, attached Side Panel, and bottom panel | 180 ms | 140 ms |
| Floating Side Panel | 180 ms | 140 ms |
| Floating panel launcher | 100 ms | 75 ms |
| Newly streamed text chunks | 240 ms once | None |

- Enter with `cubic-bezier(0.33, 1, 0.68, 1)`. Exit with `cubic-bezier(0.32, 0, 0.67, 0)`. Reversing continues from the current value.
- Reveal tree children from the top. Clip panels while their contents keep their saved size. Divider dragging follows the pointer directly. Virtualized trees change instantly.
- Dragging below half a panel's minimum size previews closing on every edge. Keep the panel visible at its minimum, fade it to 40% opacity, and highlight the separator with `fg.warning`. Moving back removes the preview. Release closes; Escape or pointer cancel restores the size before the drag. Drag, double-click, and Home keep the saved size for reopening. Panels that cannot close only clamp.
- Anchor the floating panel at its bottom right. Start at 96% scale and 8 px below its final position. The launcher leaves at 90% scale.
- Hover actions appear immediately and hide after 150 ms. Reserve their space so the label stays still.
- Fade only new response chunks. Earlier text keeps its DOM. Loaded history appears immediately. Incomplete Markdown may reinterpret the affected structure as syntax finishes.
- Follow the operating system's reduced motion setting. Tree reveals, chevrons, panel sizes, and streamed text become instant. The floating panel and launcher keep opacity fades with no position or scale change.
- Motion ends without background work. Hidden panels remain mounted to preserve their state and live connections. Exiting content becomes inert immediately.

See [the production motion decision](../documentation/adrs/0070-production-motion-on-theme-tokens.md). After the UI release, Motion Lab should read adopted timings from the released theme instead of retaining its proposed copies.
