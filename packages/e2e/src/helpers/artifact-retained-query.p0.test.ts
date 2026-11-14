import { expect, test } from "bun:test";
import { createWebviewClient, type QueryChangeEnvelope } from "@pstdio/sdk/extensions";
import { createMemoryRepoFiles, createMemoryStorage, makeCommandArgs } from "@pstdio/sdk/testing";
import { changedEvent, commands, createArtifactQueries, extensionId } from "pstdio-artifacts/testing";
import { createRetainedExtensionQueryFixture } from "./retained-extension-query.fixture";

const turn = () => new Promise<void>((resolve) => setImmediate(resolve));
const fixture = async () => {
  const storage = createMemoryStorage({ extensionId });
  const files = createMemoryRepoFiles();
  const snapshots = createMemoryRepoFiles();
  const reads = { list: 0, revisions: 0, read: 0 };
  let transport: ReturnType<typeof createRetainedExtensionQueryFixture>;
  const emit = (scope: QueryChangeEnvelope) =>
    transport.emit(changedEvent, scope.projectId ?? "selected", scope.resourceIds);
  const [ctx] = makeCommandArgs({
    projectId: "selected",
    storage,
    params: {},
    overrides: {
      extensionId,
      projectFiles: files,
      artifacts: { mount: () => snapshots },
      events: {
        emit: async (_event, _payload, options) => {
          emit(options?.refresh ?? {});
          return { delivered: 0 };
        },
      },
    },
  });
  transport = createRetainedExtensionQueryFixture({
    extensionId,
    execute: async (input, signal) => {
      const key = input.commandId.split(".command.")[1] as keyof typeof commands;
      if (key === "read" || key === "revisions" || key === "list") reads[key]++;
      const run = commands[key].run as (context: typeof ctx, params: Record<string, unknown>) => unknown;
      return await run({ ...ctx, signal }, input.params ?? {});
    },
  });
  const frame = transport.frame();
  const client = createWebviewClient<typeof commands>(frame.host);
  const publish = async (title: string, url?: string) => {
    await files.writeText("page.html", `<title>${title}</title><p>${title}</p>`);
    return client.commands.publish({ file_path: "page.html", ...(url ? { url } : {}) });
  };
  const first = await publish("First");
  const second = await publish("Other artifact");
  const current = await publish("Current", first.url);
  return {
    client,
    queries: createArtifactQueries(client, "selected"),
    reads,
    first,
    second,
    current,
    publish,
    emit,
    events: frame.listeners,
    dispose: () => {
      client.queries.dispose();
      frame.dispose();
      transport.dispose();
    },
  };
};

test("publishing updates the artifact index while accepted previews keep running at their chosen revision", async () => {
  const f = await fixture();
  const list = f.queries.list();
  const revisions = f.queries.revisions(f.first.artifactId);
  const live = f.queries.content(f.first.artifactId);
  const pinned = f.queries.content(f.first.artifactId, f.first.revisionId);
  const other = f.queries.content(f.second.artifactId);
  const stops = [list, revisions, live, pinned, other].map((query) => query.subscribe(() => {}));
  await turn();
  expect(f.reads).toEqual({ list: 1, revisions: 1, read: 3 });
  expect(await f.queries.preview(f.first)).toContain("First");
  expect(f.reads.read).toBe(3);
  f.emit({ projectId: "other", extensionId, resourceIds: [f.first.artifactId] });
  await turn();
  expect(f.reads).toEqual({ list: 1, revisions: 1, read: 3 });
  await f.publish("New live revision", f.first.url);
  await turn();
  expect(live.getSnapshot().data?.html).toContain("Current");
  expect(pinned.getSnapshot().data?.html).toContain("First");
  expect(other.getSnapshot().data?.html).toContain("Other artifact");
  expect(revisions.getSnapshot().data).toHaveLength(3);
  expect(f.reads).toEqual({ list: 2, revisions: 2, read: 3 });
  for (const stop of stops) stop();
  const again = live.subscribe(() => {});
  await turn();
  expect(f.reads.read).toBe(3);
  again();
  f.dispose();
  expect(f.events.size).toBe(0);
});

test("inactive artifact readers retain the running preview and catch up their index only when observed again", async () => {
  const f = await fixture();
  const live = f.queries.content(f.first.artifactId);
  const revisions = f.queries.revisions(f.first.artifactId);
  let stop = live.subscribe(() => {});
  let stopIndex = revisions.subscribe(() => {});
  await turn();
  stop();
  stopIndex();
  await f.publish("Accepted while away", f.first.url);
  await turn();
  expect(f.reads.read).toBe(1);
  expect(f.client.queries.inspect().active).toBe(0);
  stop = live.subscribe(() => {});
  stopIndex = revisions.subscribe(() => {});
  expect(live.getSnapshot().data?.html).toContain("Current");
  await turn();
  expect(live.getSnapshot().data?.html).toContain("Current");
  expect(revisions.getSnapshot().data).toHaveLength(3);
  expect(f.reads).toEqual({ list: 0, revisions: 2, read: 1 });
  stop();
  stopIndex();
  f.dispose();
  expect(live.getSnapshot().data).toBeUndefined();
});
