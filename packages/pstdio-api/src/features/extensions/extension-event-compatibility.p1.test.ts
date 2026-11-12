import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createWebviewClient, type GuestHost } from "@pstdio/sdk/extensions";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { createTestApp } from "../../test-utils/create-test-app";
import { publishExtensionEventNotifications } from "./extension-event-notifications";

test.each([
  "dashboard",
  "api",
])("old and current guests refresh once after a %s command while hooks run once", async (source) => {
  const root = mkdtempSync(join(tmpdir(), "extension-event-compatibility-"));
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({
      name: "notes",
      publisher: "pstdio",
      version: "1.0.0",
      main: "extension.ts",
      engines: { pstdio: `^${EXTENSION_API_VERSION}` },
    }),
  );
  writeFileSync(
    join(root, "extension.ts"),
    `export default {
    commands:[{id:"save",ref:{kind:"command",id:"save"},title:"Save",run:async ctx=>{
      await ctx.events.emit({kind:"event",id:"changed"},{});
      return (await ctx.storage.get("hooks")) ?? 0;
    }}],
    hooks:[{id:"observe",ref:{kind:"hook",id:"observe"},event:{kind:"event",extensionId:"pstdio.pstdio-notes",id:"changed"},run:async ctx=>ctx.storage.set("hooks",((await ctx.storage.get("hooks"))??0)+1)}],
    views:[{id:"reader",ref:{kind:"view",id:"reader"},title:"Reader",body:{kind:"controls",refreshEvents:[{kind:"event",extensionId:"pstdio.pstdio-notes",id:"changed"}],query:async()=>({fields:[],values:{}})}}]
  }`,
  );
  const app = await createTestApp();
  const listeners = new Set<(payload: unknown) => void>();
  const host: GuestHost = {
    extensionId: "example.consumer",
    call: async () => {
      throw new Error("No request expected");
    },
    onEvent: (_scope, listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  const guest = createWebviewClient<Record<never, never>>(host);
  let oldCalls = 0;
  let currentCalls = 0;
  guest.events.subscribe({ kind: "event", extensionId: "pstdio.pstdio-notes", id: "changed" }, () => oldCalls++);
  guest.events.subscribe({ kind: "event", extensionId: "pstdio.notes", id: "changed" }, () => currentCalls++);
  const deliver = (id: string, projectId: string) => {
    for (const listener of listeners) listener({ type: "changed", id, projectId });
  };
  try {
    const project = await app.deps.projectService.create({ name: "Events" });
    const enabled = await app.deps.extensionService.enableInstalledSourceForProject({
      projectId: project.id,
      sourcePath: root,
      sourceKind: "local_path",
      extensionId: "pstdio.notes",
      installName: "notes",
      name: "notes",
      displayName: "Notes",
      manifest: {},
    });
    const stop = app.eventBus.subscribe((event) => {
      if (event.table !== "extension_events") return;
      const data = event.data as { eventId: string; projectId: string };
      if (data.projectId === project.id) deliver(data.eventId, data.projectId);
    });
    const response = await app.app.request(
      `/v1/projects/${project.id}/extensions/commands/pstdio.notes.command.save/execute`,
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ source }) },
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.outcome).toMatchObject({ ok: true, value: 1 });
    expect(body.eventIds.filter((id: string) => id.includes("changed"))).toEqual(["pstdio.notes.event.changed"]);
    if (source === "dashboard") for (const event of body.events) deliver(event.id, project.id);
    expect(oldCalls).toBe(1);
    expect(currentCalls).toBe(1);
    await app.deps.extensionService.setProjectExtensionEnabled(enabled.instance.id, false);
    const snapshot = await app.deps.extensionRuntimeCatalog.get(project.id);
    expect(snapshot.runtime.extensions.some((extension) => extension.id === "pstdio.notes")).toBe(false);
    const seq = app.eventBus.seq;
    publishExtensionEventNotifications(app.eventBus, snapshot.runtime, "pstdio.notes.event.changed", {
      projectId: project.id,
    });
    expect(app.eventBus.getSince(seq).map((event) => (event.data as { eventId: string }).eventId)).toEqual([
      "pstdio.notes.event.changed",
    ]);
    expect(oldCalls).toBe(1);
    stop();
  } finally {
    listeners.clear();
    await app.close();
    rmSync(root, { recursive: true, force: true });
  }
});
