import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { createChatSession } from "../../../extensions/contributions/chat-session";
import { WorkbenchThemeProvider } from "../../theme/workbench-theme-provider";
import { NativeChatErrors } from "./native-chat-status";

test("native chat action failures are dismissible and readable", () => {
  const session = createChatSession({ query: async () => ({}), action: async () => ({}) });
  session.reportError(new Error("The conversation could not be loaded."));
  const html = renderToStaticMarkup(
    <WorkbenchThemeProvider>
      <NativeChatErrors state={session.getSnapshot()} session={session} />
    </WorkbenchThemeProvider>,
  );
  expect(html).toContain('role="alert"');
  expect(html).toContain("The conversation could not be loaded.");
  expect(html).toContain('aria-label="Dismiss"');
  expect(html.includes('aria-label="Copy error message"')).toBe(true);
  expect(html).not.toContain(">Retry<");
});

test("native chat without a failure does not show an error alert or retry", () => {
  const session = createChatSession({ query: async () => ({}), action: async () => ({}) });
  const html = renderToStaticMarkup(
    <WorkbenchThemeProvider>
      <NativeChatErrors state={session.getSnapshot()} session={session} />
    </WorkbenchThemeProvider>,
  );
  expect(html).not.toContain('role="alert"');
  expect(html).not.toContain('aria-label="Copy error message"');
  expect(html).not.toContain(">Retry<");
});

test("dismissing a conversation failure preserves the composer draft", () => {
  const session = createChatSession({ query: async () => ({}), action: async () => ({}) });
  session.changeDraft({ text: "Keep this draft" });
  session.reportError(new Error("Connection lost"));
  session.dismissError();
  expect(session.getSnapshot().error).toBeUndefined();
  expect(session.getSnapshot().draft.text).toBe("Keep this draft");
});
