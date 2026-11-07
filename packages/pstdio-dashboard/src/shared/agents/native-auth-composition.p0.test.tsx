import { expect, test } from "bun:test";
import { createWorkbench } from "@pstdio/workbench";
import { WorkbenchThemeProvider } from "@pstdio/workbench/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nextProvider } from "react-i18next";
import i18n from "@/i18n/config";
import { createChatSession } from "../../../../pstdio-workbench/src/extensions/contributions/chat-session";
import type { NativeChatHostProps } from "../../../../pstdio-workbench/src/react/renderers/chat/native-chat-host";
import { NativeChatView } from "../../../../pstdio-workbench/src/react/renderers/chat/native-chat-view";
import { useNativeHarnessAccount } from "./use-native-harness-account";

const renderAccount = async (
  status: "signed_out" | "signed_in" | "checking" | "error",
  history = false,
  supportsModels = false,
) => {
  const queries = new QueryClient();
  queries.setQueryData(
    ["agents-info", "p"],
    [{ id: "agent", name: "Claude Code", availability: { type: "INSTALLED" }, supportsModels }],
  );
  const key = ["harness-authentication", "p", "agent", undefined];
  if (status !== "checking") queries.setQueryData(key, { status: status === "error" ? "signed_out" : status });
  if (status === "error")
    queries
      .getQueryCache()
      .find({ queryKey: key })!
      .setState({ status: "error", error: new Error("Unavailable") });
  const session = createChatSession({
    initial: {
      nativeHarnessAccount: { controlId: "provider" },
      values: { provider: { harnessId: "agent" } },
      messages: history
        ? [{ id: "reply", role: "assistant", parts: [{ type: "text", text: "Retained history" }] }]
        : [],
    },
    query: async () => ({}),
    action: async () => ({}),
  });
  const release = session.retain();
  await new Promise<void>((resolve) => {
    if (!session.getSnapshot().initializing) resolve();
    else {
      const off = session.subscribe(() => {
        if (!session.getSnapshot().initializing) {
          off();
          resolve();
        }
      });
    }
  });
  const workbench = createWorkbench();
  let account!: ReturnType<typeof useNativeHarnessAccount>;
  let panel!: ReactElement<{ messages: unknown[] }>;
  const Host = ({ children, values }: NativeChatHostProps) => {
    account = useNativeHarnessAccount({
      workbench,
      projectId: "p",
      session,
      binding: { controlId: "provider" },
      value: values.provider,
      initializing: false,
    });
    panel = children({ account }) as typeof panel;
    return panel;
  };
  const html = renderToStaticMarkup(
    <QueryClientProvider client={queries}>
      <I18nextProvider i18n={i18n}>
        <WorkbenchThemeProvider>
          <NativeChatView session={session} action={undefined} conversationKey="auth" Host={Host} />
        </WorkbenchThemeProvider>
      </I18nextProvider>
    </QueryClientProvider>,
  );
  release();
  workbench.dispose();
  queries.clear();
  return { html, account, panel };
};
test("signed-out account replaces normal empty content with one setup surface while retaining the composer", async () => {
  const { html, account } = await renderAccount("signed_out");
  expect(html.includes("Sign in to Claude Code")).toBe(true);
  expect(html.includes("No messages yet")).toBe(false);
  expect(html.includes('data-testid="content-editable"')).toBe(true);
  expect(account?.blocked).toBe(true);
});
test("authentication discovery keeps normal empty content quietly without enabling submission", async () => {
  const { html, account } = await renderAccount("checking");
  expect(html.includes("Checking harness authentication")).toBe(false);
  expect(html.includes("No messages yet")).toBe(true);
  expect(account?.blocked).toBe(true);
});
test("setup stays alongside existing history and errors keep Retry; signed-in empty state remains normal", async () => {
  const history = await renderAccount("signed_out", true);
  expect(history.panel.props.messages).toMatchObject([{ id: "reply" }]);
  expect(history.html.match(/Sign in to Claude Code/g)).toHaveLength(1);
  const error = await renderAccount("error");
  expect(error.html.includes("Could not check harness authentication.")).toBe(true);
  expect(error.html.includes(">Retry<")).toBe(true);
  expect(error.html.includes("No messages yet")).toBe(false);
  const ready = await renderAccount("signed_in");
  expect(ready.html.includes("No messages yet")).toBe(true);
  expect(ready.account?.blocked).toBe(false);
});

test("a signed-in harness awaiting model selection keeps normal empty content while submission stays blocked", async () => {
  const { html, account } = await renderAccount("signed_in", false, true);
  expect(html.includes("No messages yet")).toBe(true);
  expect(html.includes("Checking harness authentication")).toBe(false);
  expect(account?.blocked).toBe(true);
});
