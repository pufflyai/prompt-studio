import { expect, test } from "bun:test";
import { ChakraProvider } from "@chakra-ui/react";
import { renderToStaticMarkup } from "react-dom/server";
import { psTheme } from "@/theme";
import { ChatPanel } from "./chat-panel";

const renderQueue = (readOnlyQueue: boolean) =>
  renderToStaticMarkup(
    <ChakraProvider value={psTheme}>
      <ChatPanel
        messages={[]}
        queuedFollowUps={[{ id: "queued", prompt: "Saved request", position: 1 }]}
        readOnlyQueue={readOnlyQueue}
        onQueuedFollowUpUpdate={() => {}}
        onQueuedFollowUpRemove={() => {}}
        onQueuedFollowUpMove={() => {}}
        streaming
        onInterrupt={() => {}}
      />
    </ChakraProvider>,
  );

test("an editable queue exposes editing, removal and reordering", () => {
  const html = renderQueue(false);
  expect(html.includes('aria-label="Edit queued message:')).toBe(true);
  expect(html.includes('aria-label="Remove queued follow-up"')).toBe(true);
  expect(html.includes('aria-label="Drag queued follow-up')).toBe(true);
});

test("a read-only queue hides mutation controls while the online composer stays available", () => {
  const html = renderQueue(true);
  expect(html).toContain("Saved request");
  expect(html.includes('aria-label="Edit queued message:')).toBe(false);
  expect(html.includes('aria-label="Remove queued follow-up"')).toBe(false);
  expect(html.includes('aria-label="Drag queued follow-up')).toBe(false);
  expect(html).toContain('aria-label="Stop Response"');
});
