import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { createChatSession } from "../../../extensions/contributions/chat-session";
import { WorkbenchThemeProvider } from "../../theme/workbench-theme-provider";
import { NativeChatNotices } from "./native-chat-status";

test("native chat failures use an error alert with readable details, copy, and retry", () => {
  const session = createChatSession({ query: async () => ({}), action: async () => ({}) });
  session.reportError(new Error("The conversation could not be loaded."));
  const html = renderToStaticMarkup(
    <WorkbenchThemeProvider>
      <NativeChatNotices host={{}} state={session.getSnapshot()} session={session} />
    </WorkbenchThemeProvider>,
  );
  expect(html).toContain('role="alert"');
  expect(html).toContain("The conversation could not be loaded.");
  expect(html.includes('aria-label="Copy error message"')).toBe(true);
  expect(html).toContain(">Retry<");
});

test("native chat without a failure does not show an error alert or retry", () => {
  const session = createChatSession({ query: async () => ({}), action: async () => ({}) });
  const html = renderToStaticMarkup(
    <WorkbenchThemeProvider>
      <NativeChatNotices host={{}} state={session.getSnapshot()} session={session} />
    </WorkbenchThemeProvider>,
  );
  expect(html).not.toContain('role="alert"');
  expect(html).not.toContain('aria-label="Copy error message"');
  expect(html).not.toContain(">Retry<");
});
