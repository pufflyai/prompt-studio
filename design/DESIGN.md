# Design rules

> **Human-editable only.** Agents must read and follow this file. Agents must not edit it unless a human explicitly requests changes to this file.

These conventions apply to the app and its extensions. Add a rule only when a designer could reasonably choose differently and Prompt Studio needs one consistent choice.

Appearance belongs in [Pencil](prompt-studio-design-system.pen), component APIs in [Storybook](../documentation/guides/development/0003-storybook-coverage.md), and motion values in the [shared theme](../packages/ui/src/theme/primitives/motion.ts). See the [motion decision](../documentation/adrs/0070-production-motion-on-theme-tokens.md) for implementation details.

## 1. Navigation

1. Pages with their own navigation replace the project tree.
2. The project breadcrumb returns to the last root-level page. Start is the fallback.

## 2. Tabs

1. Single-resource views have no tab strip or close action.
2. Multi-resource views keep both, even with one tab.
3. Tabs stay on one row and scroll when full.
4. Pinning never changes their order.
5. Tabs have no borders. Use backgrounds to show selection and hover.

## 3. Control sizes

1. Use small controls in dialogs and settings.
2. Use extra-small controls for inline file creation and renaming in the side navigation.
3. Popovers use `xs` horizontal padding and `2xs` vertical padding, defined in the shared popover recipe.

## 4. Delete actions

1. Icon-only delete actions use `destructive-ghost`: subdued at rest, error colors on interaction.
2. Close and dismiss actions keep their own styles.

## 5. Long names

1. Shorten paths and resource names in the middle, preserving their beginning and ending, including the file extension when possible.

## 6. Feedback placement

1. System errors sit at the leading, left-aligned end of the status bar. Other app-wide indicators sit at the trailing end; normal states stay muted. The error widget label shows the latest error without a count suffix; its popover shows the count.
2. Connection loss shows an amber Reconnecting indicator there while loaded navigation stays visible.
3. Never use toast notifications for errors.
4. System errors appear in a status-bar widget. Show an indicator with the error when it occurs; opening the widget shows its details. This widget is for system errors only.
5. When a user action cannot be completed, show the failure in the UI where the user tried the action, beside the relevant control or content.
6. Chat problems appear in the conversation, without banners.
7. The system-error and performance popovers share their width and gap above the status bar. Each aligns with its widget: system errors on the left, performance on the right. Long error lists grow with the viewport and scroll inside the popover. Keep the count and dismissal controls visible when text is long.
8. Pending system errors keep the status bar visible even when the active mode hides it. Restore the mode's hidden state after the last system error is dismissed. Custom status-bar content stays available beside the error widget.
9. Notification recovery buttons appear inside their `AlertMessage`, below the message. Keep recovery failures inside that same alert.

## 7. Activity

1. Show a spinner or elapsed time. Keep the duration after completion.
2. Never shimmer or pulse status text; newly streamed text may fade once.

## 8. Hover

1. Feedback is immediate.
2. Button hover exits wait 150 ms; menu items and button groups do not.
3. Explanatory tooltips wait 300 ms.

## 9. Chat composer

1. The chat input is borderless at rest and shows an accent highlight while focus is inside it. Its surrounding workspace container stays borderless.
2. The workspace container uses the same background as a selected tab.

## 10. Scrolling

1. Always use the shared `ScrollArea` component for scrollable containers. This includes popovers, dialogs, panels, and lists; do not create scrollable surfaces with raw overflow styles.
3. Main and side chat views fill their panels with the same composer inset. The workspace header touches the input without an extra gap.
