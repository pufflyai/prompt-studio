import { expect, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, create } from "react-test-renderer";
import { API_FILE_URL_QUERY_KEY, useApiFileParts } from "./api-file-url";

test("streaming a chat with an attachment keeps completed message objects stable", async () => {
  const client = new QueryClient();
  const url = "/v1/files/attachment/content";
  client.setQueryData([API_FILE_URL_QUERY_KEY, url], "blob:attachment");
  const attachment = { id: "prompt", role: "user" as const, parts: [{ type: "file" as const, url }] };
  const completed = {
    id: "completed",
    role: "assistant" as const,
    parts: [{ type: "text" as const, text: "Finished response" }],
  };
  let messages = [attachment, completed];
  let displayed: ReturnType<typeof useApiFileParts> = [];
  const Chat = () => {
    displayed = useApiFileParts(messages);
    return null;
  };
  const render = () => (
    <QueryClientProvider client={client}>
      <Chat />
    </QueryClientProvider>
  );
  let root!: ReturnType<typeof create>;
  try {
    await act(async () => {
      root = create(render());
    });
    const first = displayed;
    messages = [...messages, { ...completed, id: "active" }];
    await act(async () => {
      root.update(render());
    });

    expect(displayed[0].parts[0]).toMatchObject({ url: "blob:attachment" });
    expect(displayed[0]).toBe(first[0]);
    expect(displayed[1]).toBe(first[1]);
    expect(displayed[1]).toBe(completed);
  } finally {
    await act(async () => root?.unmount());
    client.clear();
  }
});
