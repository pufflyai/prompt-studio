import { expect, test } from "bun:test";
import { workbenchCommands, workbenchPages, workbenchPanels } from "./builtin-refs";
import { sessionBrowser, sessionBrowserId } from "./session-browser-refs";

test("Sessions provider targets are qualified without importing its implementation", () => {
  expect(sessionBrowser.pages.session).toEqual({ kind: "page", extensionId: sessionBrowserId, id: "session" });
  expect(sessionBrowser.views.list).toEqual({ kind: "view", extensionId: sessionBrowserId, id: "list" });
  expect(sessionBrowser.panels.conversation).toEqual({
    kind: "placement",
    extensionId: sessionBrowserId,
    id: "conversation",
  });
  expect(sessionBrowser.commands.open).toMatchObject({ kind: "command", extensionId: sessionBrowserId, id: "open" });
  expect(sessionBrowser.commands.create).toMatchObject({ kind: "command", extensionId: sessionBrowserId, id: "new" });
});
test("deprecated host refs retain their published identity", () => {
  expect(workbenchPages.session).toEqual({ kind: "page", extensionId: "pstdio", id: "session" });
  expect(workbenchPanels.projectSession).toEqual({ kind: "placement", extensionId: "pstdio", id: "project-session" });
  expect(workbenchCommands.newConversation.id).toBe("dashboard.createSession");
});
