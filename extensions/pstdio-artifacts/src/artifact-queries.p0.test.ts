import { expect, test } from "bun:test";
import { createWebviewClient, type GuestHost } from "@pstdio/sdk/extensions";
import { createArtifactQueries } from "./artifact-queries";
import type { ArtifactSummary } from "./artifacts";
import type { commands } from "./commands";
import { artifactResource, artifactTarget, artifactUrl } from "./contracts";
import { extensionId } from "./events";

const turn = () => new Promise<void>((resolve) => setImmediate(resolve));

test("removing a lazy artifact preview releases its finite read membership", async () => {
  const calls: { operation: string; requestId: string }[] = [];
  const reply = Promise.withResolvers<unknown>();
  const host = {
    extensionId,
    propsStore: {
      get: () => ({ projectId: "selected", commandQueries: { owner: "previews", values: [] } }),
      subscribe: () => () => {},
    },
    onEvent: () => () => {},
    call: async (_method: string, input: { operation: string; requestId: string }) => {
      calls.push(input);
      if (input.operation === "close") return;
      return reply.promise;
    },
  } as unknown as GuestHost;
  const client = createWebviewClient<typeof commands>(host);
  const abort = new AbortController();
  const reading = createArtifactQueries(client, "selected")
    .preview({ artifactId: "item", revisionId: "chosen" } as ArtifactSummary, abort.signal)
    .catch(() => undefined);
  try {
    await turn();
    abort.abort();
    await turn();
    expect(calls.filter((call) => call.operation === "close")).toHaveLength(1);
  } finally {
    client.queries.dispose();
    reply.resolve(undefined);
    await reading;
  }
});

test("a recreated artifact frame restores the chosen immutable revision without reading another body", () => {
  const content = {
    id: "chosen",
    artifactId: "item",
    title: "Chosen revision",
    publishedAt: "2026-11-12T00:00:00Z",
    size: 22,
    hash: "chosen-html",
    url: artifactUrl("selected", "item"),
    resource: artifactResource("selected", "item", "Chosen revision"),
    target: artifactTarget("selected", "item", "Chosen revision"),
    html: "<p>Chosen revision</p>",
    revisionId: "chosen",
  };
  const host = {
    extensionId,
    propsStore: {
      get: () => ({
        projectId: "selected",
        commandQueries: {
          owner: "selected-artifacts",
          values: [
            {
              command: {
                commandId: `${extensionId}.command.read`,
                params: { url: artifactUrl("selected", "item"), revisionId: "chosen" },
                resource: artifactResource("selected", "item"),
              },
              snapshot: { generation: 1, version: 2, data: content, stale: false, fetching: false },
            },
          ],
        },
      }),
      subscribe: () => () => {},
    },
    onEvent: () => () => {},
    call: async () => {
      throw new Error("Restoration cannot read another artifact body");
    },
  } as unknown as GuestHost;
  const client = createWebviewClient<typeof commands>(host);
  try {
    expect(createArtifactQueries(client, "selected").content("item", "chosen").getSnapshot().data).toEqual(content);
  } finally {
    client.queries.dispose();
  }
});
