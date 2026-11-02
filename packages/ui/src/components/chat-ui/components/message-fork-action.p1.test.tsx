import { expect, test } from "bun:test";
import { ChakraProvider } from "@chakra-ui/react";
import { renderToStaticMarkup } from "react-dom/server";
import { psTheme } from "../../../theme";
import { MessageActionPanel } from "./message-action-panel";

test("an agent reply exposes a keyboard action and explains why pending work blocks it", () => {
  const html = renderToStaticMarkup(
    <ChakraProvider value={psTheme}>
      <MessageActionPanel
        message={{ id: "earlier-reply", role: "assistant", parts: [{ type: "text", text: "First approach" }] }}
        alwaysVisible
        onForkMessage={async () => {}}
        forkDisabledReason="Finish pending work first."
      />
    </ChakraProvider>,
  );
  expect(html).toContain('aria-label="Fork conversation"');
  expect(html).toContain('aria-disabled="true"');
  expect(html).toContain('title="Finish pending work first."');
});
