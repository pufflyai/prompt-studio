import { expect, test } from "bun:test";
import type { SessionMessage } from "@pstdio/ui/chat-ui";
import { createApiFilePartsResolver } from "./api-file-parts";

test("resolved attachments follow URL readiness and permission changes without retaining an old blob URL", () => {
  const resolve = createApiFilePartsResolver();
  const url = "/v1/files/attachment/content";
  const message: SessionMessage = {
    id: "prompt",
    role: "user",
    parts: [
      { type: "text", text: "Question" },
      { type: "file", url },
    ],
  };
  const messages = [message];
  const pending = resolve(messages, new Map([[url, ""]]));
  expect(pending[0].parts[1]).toMatchObject({ url: "" });
  const ready = resolve(messages, new Map([[url, "blob:first"]]));
  expect(ready[0].parts[1]).toMatchObject({ url: "blob:first" });
  expect(ready[0].parts[0]).toBe(message.parts[0]);
  expect(resolve(messages, new Map([[url, "blob:first"]]))).toBe(ready);
  const renewed = resolve(messages, new Map([[url, "blob:renewed"]]));
  expect(renewed[0]).not.toBe(ready[0]);
  expect(renewed[0].parts[1]).toMatchObject({ url: "blob:renewed" });
  expect(resolve(messages, new Map())).toBe(messages);
  expect(message.parts[1]).toEqual({ type: "file", url });
});

test("a replacement attachment with the same message ID updates its metadata and preserves untouched parts", () => {
  const resolve = createApiFilePartsResolver();
  const url = "/v1/files/attachment/content";
  const messages: SessionMessage[] = [{ id: "prompt", role: "user", parts: [{ type: "file", url, filename: "old" }] }];
  const urls = new Map([[url, "blob:attachment"]]);
  const first = resolve(messages, urls);
  const replaced: SessionMessage = { ...messages[0], parts: [{ type: "file", url, filename: "new" }] };
  const next = resolve([replaced], urls);
  expect(next[0]).not.toBe(first[0]);
  expect(next[0].parts[0]).toMatchObject({ url: "blob:attachment", filename: "new" });
});
