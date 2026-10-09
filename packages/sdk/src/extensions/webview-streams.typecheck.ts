import { defineCommand, streamOf } from "./define-command";
import { defineExtension } from "./define-extension";
import type { GuestHost } from "./guest-host";
import { params } from "./params";
import { createWebviewClient } from "./webview-client";

const commands = {
  tail: defineCommand({
    id: "tail",
    title: "Tail",
    params: { source: params.text({ required: true }) },
    stream: streamOf<{ line: string }>(),
    async run(ctx, input) {
      await ctx.stream.write({ line: input.source });
      // @ts-expect-error Chunks follow the declaration.
      await ctx.stream.write({ line: 1 });
      return { count: 1 };
    },
  }),
  read: defineCommand({ id: "read", title: "Read", run: () => "value" }),
};
defineExtension({ commands: Object.values(commands) });
export const checkStreamTypes = (host: GuestHost) => {
  const client = createWebviewClient<typeof commands>(host, { extensionId: "logs" });
  const stream = client.streams.tail({ source: "file" });
  const result: Promise<{ count: number }> = stream.result;
  const iterable: AsyncIterable<{ line: string }> = stream;
  const plain: Promise<string> = client.commands.read();
  // @ts-expect-error Only stream declarations appear in this map.
  client.streams.read();
  // @ts-expect-error Required parameters remain required.
  client.streams.tail();
  return { result, iterable, plain };
};
