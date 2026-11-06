import { expect, test } from "bun:test";
import { ChakraProvider } from "@chakra-ui/react";
import { renderToStaticMarkup } from "react-dom/server";
import { psTheme } from "../../../theme";
import { ChatMessageListResponse } from "./chat-message-list-items";
import { MessageActionPanel } from "./message-action-panel";

test("an agent reply exposes a keyboard action and explains why its fork is unavailable", () => {
  const html = renderToStaticMarkup(
    <ChakraProvider value={psTheme}>
      <MessageActionPanel
        message={{ id: "earlier-reply", role: "assistant", parts: [{ type: "text", text: "First approach" }] }}
        alwaysVisible
        onForkMessage={async () => {}}
        forkDisabledReason="Fork unavailable."
      />
    </ChakraProvider>,
  );
  expect(html).toContain('aria-label="Fork conversation"');
  expect(html).toContain('aria-disabled="true"');
  expect(html).toContain('title="Fork unavailable."');
});

test("earlier replies offer Fork while the active reply is still streaming", () => {
  const response = (id: string, streaming: boolean) =>
    renderToStaticMarkup(
      <ChakraProvider value={psTheme}>
        <ChatMessageListResponse
          message={{ id, role: "assistant", parts: [{ type: "text", text: "An approach" }] }}
          streaming={streaming}
          animatedKeys={new Set()}
          showAssistantActions
          onForkMessage={async () => {}}
        />
      </ChakraProvider>,
    );
  const earlier = response("earlier", false);
  const current = response("current", true);
  expect(earlier).toContain('aria-label="Fork conversation"');
  expect(earlier).not.toContain('aria-disabled="true"');
  expect(current).not.toContain('aria-label="Fork conversation"');
  expect(current).toContain('aria-label="Copy message"');
});
