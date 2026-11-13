# Sessions

Manage saved conversations from the session breadcrumb or its row in the Sessions or workspace navigation.

This page describes the session menu from the release after 0.43.x. In 0.43.x, you can rename a session from its breadcrumb and archive it with `pst sessions archive --id <session-id>`. Release 0.43.x cannot delete a session.

Choosing **New session** opens its composer. Opening a ticket or workspace previews its latest related session as an unpinned tab. This follows the shared **Open related resources** setting in Appearance, which is on by default. Turn it off to open related sessions only when you choose them. Creating a session from the UI opens it in either setting.

## Keep sessions nearby

Choose **Pin session** from a navigation row's menu to keep it in the **Pinned** section above recent sessions. **Unpin session** returns it to its date group.

Drag a session from Side onto Main to open its full session page. Drag a navigation resource onto a compatible panel's tab bar to keep it as a tab. **Reopen latest tab** in command search restores the most recently closed tab in the current project; its default shortcut is Alt+Shift+R (Option+Shift+R on macOS).

To create a session from any page, press Alt+Shift+Space, then C, then S. If several creation actions share S, choose the numbered session action. Holding Option/Alt shows shortcut hints, including in an open action menu.

## Open session actions

Select a session, then open the arrow beside its name in the breadcrumb. You can also right-click its navigation row, press Shift+F10 or the Context Menu key, or use the row's touch menu.

![Shared session actions in the breadcrumb](../../images/session-management-menu.png)

The menu acts on that session. Choosing another row's action keeps your current conversation open. New session drafts have no saved-session management actions.

## Copy a session reference

This action requires the updated Sessions extension and a host that supports copying command results to the clipboard. It is not available in 0.44.0.

Choose **Copy session ID** to copy the full Prompt Studio session ID. Paste it into another agent's conversation to identify the session you want analyzed, including a session that failed. The action copies only the ID and keeps your current conversation open.

## Rename

Choose **Rename session**. Edit the current name and choose **Run**. The name changes in navigation, the breadcrumb, and open panels. Outer spaces are trimmed. A blank name shows an inline error. Cancel or Escape keeps the current name.

## Archive

Choose **Archive session**, then confirm. Archive keeps the saved conversation and removes it from active lists and recent-session menus. Queued work is cancelled. Running work and work awaiting input continue.

## Delete

Choose **Delete session**, then confirm the named conversation. Deletion cannot be undone. Prompt Studio removes its saved session data and links, while keeping workspace files, linked resources, shared attachments, and external agent history.

Stop active or queued work before deleting. Delete is disabled for running, queued, or awaiting-input sessions. The server also checks that work has stopped and final saving has finished.

Archive and delete close only that session's views. Removing the session on the current page returns you to Sessions. A failed save restores the session and shows one inline error; you can try again.


Opening a saved session shows its linked resources in navigation. Links appear from either end: a ticket that links a session also appears beside that session. Empty link groups stay hidden. Tickets show Parent, Depends on, and Required by alongside their other resources.

Drag a resource from navigation or a side tab onto a tabless Main panel, such as Tickets, to open its resource page.

*Updated at: 2026-11-11*
