import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { createTestApp } from "../../test-utils/create-test-app";
import { createActivityApi } from "../extensions/command-environment/activity";
import { executeProjectExtensionCommand } from "../extensions/execute-project-extension-command";
import { createResourcesApi } from "../extensions/command-environment/resources";
import { createResourceActivityApi } from "./resource-activity-api";
import { createResourceActivityStore } from "./resource-activity-store";
import { streamResourceActivity } from "./resource-activity-stream";
import { createResourceChanges } from "./resource-changes";

const root = mkdtempSync(join(tmpdir(), "activity-api-"));
let app: Awaited<ReturnType<typeof createTestApp>>;
beforeAll(async () => {
  app = await createTestApp();
});
afterAll(async () => {
  await app?.close();
  rmSync(root, { recursive: true, force: true });
});
let project: Awaited<ReturnType<typeof app.deps.projectService.create>>;
let enabled: Awaited<ReturnType<typeof app.deps.extensionService.enableInstalledSourceForProject>>;
let ref: { projectId: string; extensionId: string; type: string; id: string };
beforeAll(async () => {
  project = await app.deps.projectService.create({ name: "Activity" });
  const sourcePath = join(root, "owner");
  mkdirSync(sourcePath);
  const manifest = {
    name: "activity-test",
    publisher: "example",
    version: "1.0.0",
    main: "extension.ts",
    engines: { pstdio: `^${EXTENSION_API_VERSION}` },
  };
  writeFileSync(join(sourcePath, "package.json"), JSON.stringify(manifest));
  writeFileSync(
    join(sourcePath, "extension.ts"),
    `export default {
      commands:[
        {id:"resolve",title:"Resolve",ref:{kind:"command",id:"resolve"},run(ctx,p){return p.resources.filter(r=>r.id!=="missing").map(resource=>({resource}));}},
        {id:"authorize",title:"Authorize",ref:{kind:"command",id:"authorize"},run(ctx,p){return {allowed:p.resource.id!=="private" && (p.resource.id!=="readonly" || p.operation==="read"),reason:"Private resource"};}},
        {id:"heads",title:"Heads",ref:{kind:"command",id:"heads"},run(ctx,p){if(p.resources.some(r=>r.id==="unavailable"))throw new Error("Owner temporarily unavailable");return p.resources.map(resource=>({resource,stamp:{lineage:"publication",revision:"2"}}));}},
        {id:"read",title:"Edition",ref:{kind:"command",id:"read"},run(){return {content:"Edition one",stamp:{lineage:"publication",revision:"1"}};}},
        {id:"context",title:"Context",ref:{kind:"command",id:"context"},run(){return {text:"Resource snapshot"};}}
      ],
      harnesses:[{id:"agent",ref:{kind:"harness",id:"agent"},label:"Agent",cwdRequirement:"optional",detect:()=>({available:true}),capabilities:()=>[],listModels:()=>[{id:"model"}],start:()=>({done:Promise.resolve({status:"completed"}),stop:()=>{}}),resume:()=>({done:Promise.resolve({status:"completed"}),stop:()=>{}})}],
      resourceKinds:[{id:"ticket",ref:{kind:"resource-kind",id:"ticket"},changes:{heads:{kind:"command",id:"heads"},read:{kind:"command",id:"read"}},activity:{comments:true,changes:true,outcomes:true},resolveMany:{kind:"command",id:"resolve"},authorizeActivity:{kind:"command",id:"authorize"},activityContext:{kind:"command",id:"context"}},
        {id:"note",ref:{kind:"resource-kind",id:"note"},activity:{comments:true},resolveMany:{kind:"command",id:"resolve"}},
        {id:"silent",ref:{kind:"resource-kind",id:"silent"},resolveMany:{kind:"command",id:"resolve"}}]
    };`,
  );
  enabled = await app.deps.extensionService.enableInstalledSourceForProject({
    projectId: project.id,
    sourcePath,
    sourceKind: "local_path",
    name: manifest.name,
    installName: manifest.name,
    extensionId: "example.activity-test",
    displayName: "Activity test",
    manifest,
  });
  ref = { projectId: project.id, extensionId: "example.activity-test", type: "ticket", id: "one" };
});
test("only an observed edition establishes a baseline and a newer edition remains changed", async () => {
  const api = createResourceChanges(app.deps, project.id);
  const [first] = await api.query([ref, ref, { ...ref, id: "missing" }, { ...ref, type: "silent" }]);
  expect(first).toMatchObject({ resource: ref, changedSinceSeen: false });
  const observation = await api.read(ref);
  expect(observation.content).toBe("Edition one");
  expect((await api.query([ref]))[0]?.changedSinceSeen).toBe(false);
  expect((await api.acknowledge(observation.receipt)).changedSinceSeen).toBe(true);
  expect((await api.acknowledge(observation.receipt)).changedSinceSeen).toBe(true);
  await expect(api.acknowledge(observation.receipt, { ...ref, id: "other" })).rejects.toThrow("different resource");
  await expect(api.read({ ...ref, id: "missing" })).rejects.toThrow("unavailable");
  await expect(api.query(Array.from({ length: 51 }, () => ref))).rejects.toThrow();
});

test("a provider failure cannot masquerade as successful deletion", async () => {
  const api = createResourceChanges(app.deps, project.id);
  await expect(api.query([ref, { ...ref, id: "unavailable" }])).rejects.toThrow("temporarily unavailable");
});

test("a device-qualified ref cannot read or acknowledge a colliding local resource", async () => {
  const api = createResourceChanges(app.deps, project.id);
  const device = { ownerId: "other", id: "other-device", name: "Other device" };
  await expect(api.read({ ...ref, device })).rejects.toThrow("device");
  await expect(api.query([{ ...ref, device }])).rejects.toThrow("device");
});

test("an existing viewer cannot mint an observation for a replacement account", async () => {
  let accountId = "alice";
  const deps = {
    ...app.deps,
    accountService: {
      ...app.deps.accountService,
      status: async () => {
        const captured = accountId;
        return {
          ...(await app.deps.accountService.status()),
          login: {
            managerOrigin: "https://manager.test",
            relayOrigin: "https://relay.test",
            deviceId: "device",
            accountId: captured,
          },
        };
      },
    },
  };
  const viewer = createResourcesApi(deps, { projectId: project.id, extensionId: ref.extensionId });
  accountId = "bob";
  await expect(viewer.observeChange!(ref, { lineage: "publication", revision: "1" })).rejects.toThrow("Reader changed");
});

test("Sessions reports only committed conversation changes through its installed extension", async () => {
  const sourcePath = resolve(import.meta.dir, "../../../../../extensions/pstdio-session-browser");
  const manifest = await Bun.file(join(sourcePath, "package.json")).json();
  await app.deps.extensionService.enableInstalledSourceForProject({
    projectId: project.id,
    sourcePath,
    sourceKind: "local_path",
    name: manifest.name,
    installName: manifest.name,
    extensionId: "pstdio.session-browser",
    displayName: "Sessions",
    manifest,
  });
  const session = await app.deps.sessionService.create({
    project_id: project.id,
    title: "A conversation",
    agent: "example.activity-test.harness.agent",
  });
  const resource = { type: "session", extensionId: "pstdio", projectId: project.id, id: session.id };
  const api = createResourceChanges(app.deps, project.id);
  expect(await api.query([resource])).toMatchObject([{ changedSinceSeen: false, stamp: { revision: "0" } }]);
  const rendered = await executeProjectExtensionCommand(app.deps, {
    commandId: "pstdio.session-browser.view.conversation.chat.query",
    projectId: project.id,
    body: { resource, source: "dashboard", params: { renderer: { resource } } },
  });
  if (!rendered.outcome.ok) throw Error(rendered.outcome.reason);
  const snapshot = rendered.outcome.value as { messages: unknown[]; observedChange: string };
  expect(snapshot.messages).toEqual([]);
  const receipt = snapshot.observedChange;
  expect(typeof receipt).toBe("string");
  expect((await api.acknowledge(receipt, resource)).changedSinceSeen).toBe(false);
  const observed = await api.read(resource);
  expect(observed.content).toMatchObject({ messages: [] });
  await api.acknowledge(observed.receipt, resource);
  await app.deps.sessionService.update(session.id, { title: "Renamed" });
  expect((await api.query([resource]))[0]?.changedSinceSeen).toBe(false);
  await app.deps.sessionService.update(session.id, { contentEvent: { kind: "input", id: "question" } });
  expect((await api.query([resource]))[0]?.changedSinceSeen).toBe(true);
  expect((await api.acknowledge(observed.receipt, resource)).changedSinceSeen).toBe(true);
});

test("command changes preserve human UI authors without misattributing CLI and automation", async () => {
  const sources = await app.deps.extensionService.listEnabledSourcesForProject(project.id);
  const enabledSource = sources.find((source) => source.installedSource.extension_id === ref.extensionId)!;
  for (const [source, type] of [
    ["dashboard", "user"],
    ["command-panel", "user"],
    ["cli", "system"],
    ["automation", "system"],
  ] as const) {
    const api = createActivityApi(app.deps, { projectId: project.id, enabledSource, source });
    const entry = await api.publish({ ...ref, id: "authors" }, { key: source, kind: "change", body: "changed status" });
    expect(entry.author.type).toBe(type);
  }
});

test("Activity checks owner capabilities and permissions, preserves evidence, and excludes sessions", async () => {
  const api = createResourceActivityApi(app.deps, { projectId: project.id });
  const owner = createResourceActivityApi(app.deps, { projectId: project.id, extensionId: ref.extensionId });
  expect(await api.capabilities({ ...ref, type: "silent" })).toBeNull();
  expect(
    await api.capabilities({ type: "session", id: "one", projectId: project.id, extensionId: "pstdio" }),
  ).toBeNull();
  expect(await api.capabilities({ ...ref, type: "note" })).toEqual({ comments: true });
  await expect(api.query({ resource: { ...ref, id: "private" } })).rejects.toThrow("Private");
  await expect(api.query({ resource: { ...ref, id: "missing" } })).rejects.toThrow("not found");
  await expect(api.query({ resource: { ...ref, projectId: "another-project" } })).rejects.toThrow("another project");
  await expect(api.publish(ref, { key: "change", kind: "change", body: "Changed" })).rejects.toThrow("owner");
  const file = await api.attach(ref, {
    name: "test.log",
    mimeType: "text/plain",
    data: new TextEncoder().encode("passed"),
  });
  const comment = await api.publish(ref, {
    key: "comment",
    kind: "comment",
    body: "Please review",
    attachmentIds: [file.id],
    target: { harnessId: "missing.harness", modelId: "model" },
  });
  expect(new TextDecoder().decode((await api.readAttachment(ref, file.id)).data)).toBe("passed");
  await expect(api.readAttachment({ ...ref, type: "note" }, file.id)).rejects.toThrow("not found");
  await expect(api.handoff(ref, comment.id)).rejects.toThrow("harness");
  expect((await api.get(ref, comment.id)).body).toBe("Please review");
  expect((await api.get(ref, comment.id)).handoffError).toContain("harness");
  await owner.publish(ref, {
    key: "change",
    kind: "change",
    body: "Status changed",
    changes: [{ field: "status", before: "ready", after: "in-progress" }],
  });
  const userChange = await createResourceActivityApi(app.deps, {
    projectId: project.id,
    extensionId: ref.extensionId,
    userInitiated: true,
  }).publish(ref, { key: "user-change", kind: "change", body: "changed status" });
  expect(userChange.author.type).toBe("user");
  expect(userChange.author.id).not.toBe(ref.extensionId);
  const fileOnly = await api.publish(ref, { key: "file-only", kind: "comment", body: "", attachmentIds: [file.id] });
  expect((await api.get(ref, fileOnly.id)).attachments.map((item) => item.name)).toEqual([file.name]);
  const longBody = "Evidence ".repeat(40000);
  const long = await api.publish(ref, { key: "large-comment", kind: "comment", body: longBody });
  expect((await api.resolve(ref, long.id, true)).body).toBe(longBody);
  expect((await api.get(ref, long.id)).body).toBe(longBody);
  const workspace = await app.deps.workspaceService.createStandalone({
    project_id: project.id,
    name: "Work",
    root_path: root,
  });
  const session = await app.deps.sessionService.create({
    project_id: project.id,
    title: "Implementer",
    agent: "test",
    status: "completed",
  });
  const reviewer = await app.deps.sessionService.create({
    project_id: project.id,
    title: "Reviewer",
    agent: "test",
    status: "completed",
  });
  await app.deps.workspaceSessionService.link(workspace.id, session.id);
  await app.deps.workspaceSessionService.link(workspace.id, reviewer.id);
  const revision = { workspaceId: workspace.id, sessionId: session.id, headSha: "a".repeat(40), revision: 1 };
  const implementation = await api.publish(ref, {
    key: "implementation",
    kind: "implementation",
    body: "Done",
    revision,
    validation: [{ command: "bun test", result: "passed" }],
  });
  await expect(
    api.publish(ref, {
      key: "self-review",
      kind: "review",
      body: "Passed",
      revision,
      implementationId: implementation.id,
      verdict: "passed",
    }),
  ).rejects.toThrow("independent");
  const review = await api.publish(ref, {
    key: "review",
    kind: "review",
    body: "Passed",
    revision: { ...revision, sessionId: reviewer.id },
    implementationId: implementation.id,
    verdict: "passed",
  });
  expect(review.author.id).toBe(reviewer.id);
  await expect(
    api.publish(ref, {
      key: "stale-review",
      kind: "review",
      body: "Passed",
      revision: { ...revision, headSha: "b".repeat(40), sessionId: reviewer.id },
      implementationId: implementation.id,
      verdict: "passed",
    }),
  ).rejects.toThrow("exact");
  const handoff = await api.publish(ref, {
    key: "handoff",
    kind: "comment",
    body: "Continue this work",
    target: { harnessId: "example.activity-test.harness.agent", modelId: "model" },
  });
  expect((await app.deps.sessionService.query(project.id, { anchor: ref })).rows).toHaveLength(0);
  const launches = await Promise.all([
    api.handoff(ref, handoff.id, { workspaceId: workspace.id }),
    api.handoff(ref, handoff.id, { workspaceId: workspace.id }),
  ]);
  expect(launches[0]!.sessionId).toBeString();
  expect(launches[1]!.sessionId).toBe(launches[0]!.sessionId);
  await createResourceActivityStore(app.deps.extensionStorageService, project.id).update(ref, handoff.id, (entry) => ({
    ...entry,
    sessionId: undefined,
  }));
  expect((await api.handoff(ref, handoff.id, { workspaceId: workspace.id })).sessionId).toBe(launches[0]!.sessionId);
  expect((await app.deps.sessionService.query(project.id, { anchor: ref })).rows).toHaveLength(1);
  const response = await app.app.request(`/v1/projects/${project.id}/activity/query`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ resource: ref }),
  });
  expect(response.status).toBe(200);
  expect((await response.json()).items).toHaveLength(8);
  const ready = Promise.withResolvers<void>();
  const updated = Promise.withResolvers<void>();
  let close = () => {};
  let changes = 0;
  const observing = streamResourceActivity(
    app.deps,
    { project_id: project.id, resource: ref },
    {
      aborted: false,
      sleep: async () => {},
      onAbort: (callback) => {
        close = callback;
      },
      write: async (event) => {
        if (event === "activity_ready") ready.resolve();
        if (event === "activity_changed") {
          changes++;
          updated.resolve();
        }
      },
    },
  );
  await ready.promise;
  await owner.publish(
    { ...ref, id: "another" },
    { key: "other-resource", kind: "change", body: "Other resource changed" },
  );
  await Bun.sleep(10);
  expect(changes).toBe(0);
  await owner.publish(ref, { key: "observed-change", kind: "change", body: "This resource changed" });
  await updated.promise;
  close();
  await observing;
  expect(changes).toBe(1);
  const source = createResourceActivityApi(app.deps, { projectId: project.id, extensionId: "pstdio.pstdio-reports" });
  const imported = await owner.importEntry(ref, {
    entry: { key: "legacy", kind: "implementation", body: "Old evidence", revision, attachmentIds: [file.id] },
    author: { type: "agent", id: "historical", name: "Historical agent" },
    createdAt: "2026-10-01T12:00:00.000Z",
    source: { projectId: project.id, extensionId: "pstdio.pstdio-reports", type: "report", id: "report" },
  });
  const disabled = await app.app.request(`/v1/projects/${project.id}/extensions/${enabled.instance.id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ enabled: false }),
  });
  expect(disabled.status).toBe(200);
  await expect(api.get(ref, imported.id)).rejects.toThrow();
  expect((await source.get(ref, imported.id)).body).toBe("Old evidence");
  expect(new TextDecoder().decode((await source.readAttachment(ref, file.id)).data)).toBe("passed");
  await expect(
    createResourceActivityApi(app.deps, { projectId: project.id, extensionId: "unrelated.owner" }).readAttachment(
      ref,
      file.id,
    ),
  ).rejects.toThrow();
});
