import { expect, test } from "bun:test";
import type { HarnessProvider } from "pstdio-api-contracts/extension-kernel";
import { createInvocationScope } from "pstdio-extensions";
import { createTestApp } from "../../../test-utils/create-test-app";
import {
  createTestHarnessRecord,
  createTestHarnessRegistry,
  testHarnessId,
} from "../../harnesses/test-harness-registry";
import { createSessionsApi } from "./sessions";
import { createStorageApi } from "./storage";

const fixture = async (provider: Partial<HarnessProvider>) => {
  const app = await createTestApp({
    harnessRegistry: createTestHarnessRegistry([
      createTestHarnessRecord("metadata", { provider: { cwdRequirement: "optional", ...provider } }),
    ]),
  });
  const project = await app.deps.projectService.create({ name: "Metadata lifetime" });
  const session = await app.deps.sessionService.create({
    project_id: project.id,
    title: "Session",
    agent: testHarnessId("metadata"),
    status: "completed",
  });
  await app.deps.sessionService.update(session.id, { agent_session_id: "a" });
  const input = { projectId: project.id, project: { ...project, shorthand: "M" } };
  return { app, project, session, input, api: createSessionsApi(app.deps, input) };
};

test("aborting held provider setup returns immediately and still releases its eventual subscription", async () => {
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const released = Promise.withResolvers<void>();
  const controller = new AbortController();
  const f = await fixture({
    watchCommandState: async () => {
      entered.resolve();
      await release.promise;
      return () => released.resolve();
    },
  });
  const observation = f.api.observeMetadata(f.session.id, () => {}, { signal: controller.signal });
  const result = observation.catch((error: Error) => error);
  try {
    await entered.promise;
    controller.abort();
    expect(await result).toMatchObject({ name: "AbortError" });
    release.resolve();
    await released.promise;
  } finally {
    release.resolve();
    controller.abort();
    await result;
    await f.app.close();
  }
});

test("throwing provider cleanup retires the owner and permits a fresh observed reopen", async () => {
  let installs = 0;
  const f = await fixture({
    watchCommandState: () => {
      const first = ++installs === 1;
      return () => {
        if (first) throw new Error("Provider cleanup failed");
      };
    },
  });
  try {
    const first = await f.api.observeMetadata(f.session.id, () => {});
    expect(() => first.close()).toThrow("cleanup failed");
    let notices = 0;
    const next = await f.api.observeMetadata(f.session.id, () => {
      notices++;
    });
    await f.api.rename(f.session.id, "Observed again");
    expect(installs).toBe(2);
    expect(notices).toBeGreaterThan(0);
    next.close();
  } finally {
    await f.app.close();
  }
});

test("a held replacement source reconciles after installation and serializes a closing/reopening owner", async () => {
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  let installs = 0;
  let pending = 0;
  let peak = 0;
  let releases = 0;
  const f = await fixture({
    watchCommandState: async (_ctx, input) => {
      installs++;
      if (input.agentSessionId === "b") {
        peak = Math.max(peak, ++pending);
        entered.resolve();
        await release.promise;
        pending--;
      }
      return () => {
        releases++;
      };
    },
  });
  let first: { close(): void } | undefined;
  let second: { close(): void } | undefined;
  try {
    first = await f.api.observeMetadata(f.session.id, () => {});
    await f.app.deps.sessionService.update(f.session.id, { agent_session_id: "b" });
    await entered.promise;
    first.close();
    let ready = false;
    const reopening = f.api
      .observeMetadata(f.session.id, () => {})
      .then((value) => {
        ready = true;
        second = value;
        return value;
      });
    await Bun.sleep(0);
    expect({ installs, peak, ready }).toEqual({ installs: 2, peak: 1, ready: false });
    release.resolve();
    await reopening;
    expect(peak).toBe(1);
    second?.close();
    expect(releases).toBe(3);
  } finally {
    release.resolve();
    first?.close();
    second?.close();
    await f.app.close();
  }
});

test("normal command completion releases metadata and derived storage observations without aborting execution", async () => {
  let releases = 0;
  const f = await fixture({
    watchCommandState: () => () => {
      releases++;
    },
  });
  const scope = createInvocationScope({ logger: { info() {}, warn() {}, error() {} } });
  try {
    const api = createSessionsApi(f.app.deps, { ...f.input, signal: scope.signal, scope });
    let metadata = 0;
    await api.observeMetadata(f.session.id, () => {
      metadata++;
    });
    const storage = createStorageApi(f.app.deps, {
      projectId: f.project.id,
      extensionId: "example.metadata",
      extensionInstanceId: "fixture",
      signal: scope.signal,
      scope,
    });
    let changes = 0;
    storage.scope({ type: "resource", resource: { type: "session", id: f.session.id } }).observe(() => {
      changes++;
    });
    await scope.close();
    expect(scope.signal.aborted).toBe(false);
    expect(releases).toBe(1);
    await api.rename(f.session.id, "After completion");
    const records = (
      await f.app.deps.extensionStorageService.open({
        owner: { workbenchId: f.project.id, extensionId: "example.metadata" },
      })
    ).records;
    await records.commit({ operationId: "after", edits: [{ recordId: "after", replace: { value: 1 } }] });
    expect({ metadata, changes }).toEqual({ metadata: 0, changes: 0 });
  } finally {
    await scope.close();
    await f.app.close();
  }
});
