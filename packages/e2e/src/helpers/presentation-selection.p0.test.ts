import { expect, test } from "bun:test";
import { createWebviewClient } from "@pstdio/sdk/extensions";
import { createWorkbench } from "@pstdio/workbench";
import { createWorkbenchWebviewHostAdapters } from "@pstdio/workbench/extensions";
import { createArtifactRevisionSelection } from "pstdio-artifacts/testing";
import { createChangesSelection } from "pstdio-workspaces/testing";
import { createRetainedExtensionQueryFixture } from "./retained-extension-query.fixture";

test.each([
  "artifact",
  "workspace",
] as const)("%s selection admitted before guest destruction persists the last accepted value after a failed held write", async (kind) => {
  const extensionId = "pstdio.pstdio-" + (kind === "artifact" ? "artifacts" : "workspaces");
  const core = createWorkbench();
  core.pageLocations.setProject("selected");
  const persisted = new Map<string, unknown>();
  let documentReads = 0,
    writes = 0;
  const held = Promise.withResolvers<void>(),
    entered = Promise.withResolvers<void>();
  const key = (name: string, scope: unknown) => JSON.stringify([name, scope]);
  const ownedPreferences: NonNullable<Parameters<typeof createWorkbenchWebviewHostAdapters>[0]["ownedPreferences"]> = {
    identity: ["installation"],
    get: (name, scope) => persisted.get(key(name, scope)) as string | undefined,
    set: async (name, value, scope) => {
      writes++;
      if (writes === 1) {
        entered.resolve();
        await held.promise;
        throw new Error("First write unavailable");
      }
      persisted.set(key(name, scope), value);
    },
  };
  const transport = createRetainedExtensionQueryFixture({
    extensionId,
    execute: async () => {
      documentReads++;
      throw new Error("Presentation must not read document/history");
    },
    adapters: (events, projectId) => {
      core.pageLocations.setProject(projectId);
      return createWorkbenchWebviewHostAdapters({
        workbench: core,
        extensionId,
        projectId,
        hostEvents: events,
        ownedPreferences,
      });
    },
  });
  const select = (client: ReturnType<typeof createWebviewClient>, project = "selected") =>
    kind === "artifact"
      ? createArtifactRevisionSelection(client as never, project, "artifact")
      : createChangesSelection(client as never, project, "workspace", "current");
  const first = transport.frame(),
    client = createWebviewClient(first.host),
    selection = select(client);
  let initial: Promise<unknown> | undefined, last: Promise<unknown> | undefined;
  try {
    expect((await selection.query.read()).value).toBeUndefined();
    initial = selection.save("first").catch((error) => error);
    await entered.promise;
    last = selection.save("last");
    client.queries.dispose();
    first.dispose();
    const returning = transport.frame(),
      newClient = createWebviewClient(returning.host);
    expect(select(newClient).query.getSnapshot().data?.value).toBe("last");
    held.resolve();
    expect(await initial).toBeInstanceOf(Error);
    await last;
    expect((await select(newClient).query.read()).value).toBe("last");
    const other = transport.frame("other"),
      otherClient = createWebviewClient(other.host);
    expect((await select(otherClient, "other").query.read()).value).toBeUndefined();
    expect(documentReads).toBe(0);
    expect(writes).toBe(2);
    newClient.queries.dispose();
    otherClient.queries.dispose();
  } finally {
    held.resolve();
    await initial;
    await last;
    client.queries.dispose();
    transport.dispose();
    await core.dispose();
  }
});
