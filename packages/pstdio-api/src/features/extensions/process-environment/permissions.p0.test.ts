import { afterEach, describe, expect, test } from "bun:test";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  createProcessEnvironmentPermissions,
  type ProcessEnvironmentLease,
  type ProcessEnvironmentSource,
} from "./permissions";

const startLease = (lease: ProcessEnvironmentLease, stop: (reason: unknown) => Promise<void>) =>
  lease.start(() => ({ value: undefined, stop }));

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

const setup = () => {
  const root = mkdtempSync(join(tmpdir(), "process-environment-permissions-"));
  roots.push(root);
  const sources = new Map<string, ProcessEnvironmentSource>();
  const source = (hash: string, requested = ["ANTHROPIC_API_KEY", "GH_TOKEN"]): ProcessEnvironmentSource => ({
    extension_id: "acme.agent",
    source_path: "/extensions/agent",
    source_hash: hash,
    manifest_json: { pstdio: { processEnvironment: requested } },
  });
  sources.set("project-1", source("hash-1"));
  const path = join(root, "state", "extension-process-environment.json");
  const create = () =>
    createProcessEnvironmentPermissions({
      path,
      findSource: async (projectId, extensionId) => (extensionId === "acme.agent" ? sources.get(projectId) : undefined),
    });
  return { path, sources, source, create, permissions: create() };
};

describe("process environment permissions", () => {
  test("a source starts with requested names and no grant", async () => {
    const { permissions } = setup();

    expect(await permissions.read("project-1", "acme.agent")).toMatchObject({
      requested: ["ANTHROPIC_API_KEY", "GH_TOKEN"],
      granted: [],
      stale: false,
    });
  });

  test("granting stores names for the observed source and project, never values, and survives a restart", async () => {
    const { permissions, path, create } = setup();
    const { sourceIdentity } = await permissions.read("project-1", "acme.agent");

    await permissions.grant("project-1", "acme.agent", { names: ["GH_TOKEN"], sourceIdentity });

    expect(await create().read("project-1", "acme.agent")).toMatchObject({ granted: ["GH_TOKEN"], stale: false });
    const stored = readFileSync(path, "utf8");
    expect(stored).toContain("GH_TOKEN");
    expect(stored).toContain(sourceIdentity);
    expect(stored).not.toContain("hash-1");
  });

  test("a grant applies only to the project it was given for", async () => {
    const { permissions, sources, source } = setup();
    sources.set("project-2", source("hash-1"));
    const { sourceIdentity } = await permissions.read("project-1", "acme.agent");
    await permissions.grant("project-1", "acme.agent", { names: ["GH_TOKEN"], sourceIdentity });

    expect((await permissions.read("project-2", "acme.agent")).granted).toEqual([]);
    await expect(permissions.authorize("project-2", source("hash-1"), ["GH_TOKEN"])).rejects.toMatchObject({
      code: "process_environment_not_granted",
    });
  });

  test("a grant can only choose requested names", async () => {
    const { permissions } = setup();
    const { sourceIdentity } = await permissions.read("project-1", "acme.agent");

    await expect(
      permissions.grant("project-1", "acme.agent", { names: ["OPENAI_API_KEY"], sourceIdentity }),
    ).rejects.toMatchObject({ code: "process_environment_not_requested" });
  });

  test("a grant made against source the person no longer sees is rejected", async () => {
    const { permissions, sources, source } = setup();
    const { sourceIdentity } = await permissions.read("project-1", "acme.agent");
    sources.set("project-1", source("hash-2"));

    await expect(
      permissions.grant("project-1", "acme.agent", { names: ["GH_TOKEN"], sourceIdentity }),
    ).rejects.toMatchObject({ code: "process_environment_source_changed" });
  });

  test("changed source content invalidates its grant until the person allows it again", async () => {
    const { permissions, sources, source } = setup();
    const before = await permissions.read("project-1", "acme.agent");
    await permissions.grant("project-1", "acme.agent", { names: ["GH_TOKEN"], sourceIdentity: before.sourceIdentity });
    sources.set("project-1", source("hash-2"));

    const after = await permissions.read("project-1", "acme.agent");
    expect(after).toMatchObject({ granted: [], stale: true });
    expect(after.sourceIdentity).not.toBe(before.sourceIdentity);
    await expect(permissions.authorize("project-1", source("hash-2"), ["GH_TOKEN"])).rejects.toMatchObject({
      code: "process_environment_not_granted",
    });
    // A command still running on the retired generation cannot use the old grant either.
    await expect(permissions.authorize("project-1", source("hash-1"), ["GH_TOKEN"])).rejects.toMatchObject({
      code: "process_environment_not_granted",
    });
  });

  test("starting a child requires every requested name to be declared and granted", async () => {
    const { permissions, source } = setup();
    const { sourceIdentity } = await permissions.read("project-1", "acme.agent");
    await permissions.grant("project-1", "acme.agent", { names: ["GH_TOKEN"], sourceIdentity });

    await expect(permissions.authorize("project-1", source("hash-1"), ["GH_TOKEN"])).resolves.toBeDefined();
    await expect(
      permissions.authorize("project-1", source("hash-1"), ["GH_TOKEN", "ANTHROPIC_API_KEY"]),
    ).rejects.toMatchObject({
      code: "process_environment_not_granted",
      message: expect.stringContaining("ANTHROPIC_API_KEY"),
    });
    await expect(permissions.authorize("project-1", source("hash-1"), ["OPENAI_API_KEY"])).rejects.toMatchObject({
      code: "process_environment_not_requested",
    });
  });

  test("revoking stops the children using the grant before retiring it", async () => {
    const { permissions, source } = setup();
    const { sourceIdentity } = await permissions.read("project-1", "acme.agent");
    await permissions.grant("project-1", "acme.agent", { names: ["GH_TOKEN"], sourceIdentity });
    const events: string[] = [];
    const lease = await permissions.authorize("project-1", source("hash-1"), ["GH_TOKEN"]);
    startLease(lease, async () => {
      events.push(`stopped while granted: ${(await permissions.read("project-1", "acme.agent")).granted.length > 0}`);
    });

    await permissions.revoke("project-1", "acme.agent");

    expect(events).toEqual(["stopped while granted: true"]);
    expect((await permissions.read("project-1", "acme.agent")).granted).toEqual([]);
    await expect(permissions.authorize("project-1", source("hash-1"), ["GH_TOKEN"])).rejects.toMatchObject({
      code: "process_environment_not_granted",
    });
  });

  test("a retired lease refuses to start any process", async () => {
    const { permissions, source } = setup();
    const { sourceIdentity } = await permissions.read("project-1", "acme.agent");
    await permissions.grant("project-1", "acme.agent", { names: ["GH_TOKEN"], sourceIdentity });
    const lease = await permissions.authorize("project-1", source("hash-1"), ["GH_TOKEN"]);
    await permissions.revoke("project-1", "acme.agent");
    let started = false;
    expect(() =>
      lease.start(() => {
        started = true;
        return { value: undefined, stop: async () => {} };
      }),
    ).toThrow("revoked");
    expect(started).toBe(false);
    lease.releaseUnused();
  });

  test("a revocation that finishes while a child is being authorized refuses that child", async () => {
    const { path, sources } = setup();
    const lookup = Promise.withResolvers<void>();
    const permissions = createProcessEnvironmentPermissions({
      path,
      findSource: async (projectId, _extensionId, enabledOnly) => {
        // Hold the process's enabled-source lookup until the revocation is done.
        if (enabledOnly) await lookup.promise;
        return sources.get(projectId);
      },
    });
    const { sourceIdentity } = await permissions.read("project-1", "acme.agent");
    await permissions.grant("project-1", "acme.agent", { names: ["GH_TOKEN"], sourceIdentity });
    const authorizing = permissions.authorize("project-1", sources.get("project-1")!, ["GH_TOKEN"]);
    await permissions.revoke("project-1", "acme.agent");
    lookup.resolve();
    await expect(authorizing).rejects.toMatchObject({ code: "process_environment_not_granted" });
  });

  test("a grant made while a revocation is stopping children waits, so no child starts in between", async () => {
    const { permissions, sources } = setup();
    const { sourceIdentity } = await permissions.read("project-1", "acme.agent");
    await permissions.grant("project-1", "acme.agent", { names: ["GH_TOKEN"], sourceIdentity });
    const lease = await permissions.authorize("project-1", sources.get("project-1")!, ["GH_TOKEN"]);
    const stopping = Promise.withResolvers<void>();
    startLease(lease, () => stopping.promise);
    const revoking = permissions.revoke("project-1", "acme.agent");
    const granting = permissions.grant("project-1", "acme.agent", { names: ["GH_TOKEN"], sourceIdentity });
    await Bun.sleep(10);
    await expect(permissions.authorize("project-1", sources.get("project-1")!, ["GH_TOKEN"])).rejects.toMatchObject({
      code: "process_environment_not_granted",
    });
    stopping.resolve();
    await Promise.all([revoking, granting]);
    expect(await permissions.read("project-1", "acme.agent")).toMatchObject({ granted: ["GH_TOKEN"] });
  });

  test("narrowing a grant stops the children that started under the wider grant", async () => {
    const { permissions, source } = setup();
    const { sourceIdentity } = await permissions.read("project-1", "acme.agent");
    await permissions.grant("project-1", "acme.agent", { names: ["GH_TOKEN", "ANTHROPIC_API_KEY"], sourceIdentity });
    let stopped = false;
    const lease = await permissions.authorize("project-1", source("hash-1"), ["ANTHROPIC_API_KEY"]);
    startLease(lease, async () => {
      stopped = true;
    });

    await permissions.grant("project-1", "acme.agent", { names: ["GH_TOKEN"], sourceIdentity });

    expect(stopped).toBe(true);
  });

  test("a released child is not stopped by a later revocation", async () => {
    const { permissions, source } = setup();
    const { sourceIdentity } = await permissions.read("project-1", "acme.agent");
    await permissions.grant("project-1", "acme.agent", { names: ["GH_TOKEN"], sourceIdentity });
    let stopped = false;
    const lease = await permissions.authorize("project-1", source("hash-1"), ["GH_TOKEN"]);
    startLease(lease, async () => {
      stopped = true;
    });
    lease.release();

    await permissions.revoke("project-1", "acme.agent");

    expect(stopped).toBe(false);
  });
});

describe("process environment grant persistence", () => {
  test("a grant change that cannot be saved leaves the saved grant in effect", async () => {
    const { permissions, path, create, source } = setup();
    const { sourceIdentity } = await permissions.read("project-1", "acme.agent");
    await permissions.grant("project-1", "acme.agent", { names: ["GH_TOKEN"], sourceIdentity });
    // POSIX refuses the temporary file in a read-only folder; Windows ignores folder modes but
    // refuses to replace a read-only file.
    chmodSync(dirname(path), 0o500);
    chmodSync(path, 0o400);
    const failures: unknown[] = [];
    try {
      for (const change of [
        () =>
          permissions.grant("project-1", "acme.agent", { names: ["GH_TOKEN", "ANTHROPIC_API_KEY"], sourceIdentity }),
        () => permissions.revoke("project-1", "acme.agent"),
      ])
        await change().catch((error: unknown) => failures.push(error));
    } finally {
      chmodSync(dirname(path), 0o700);
      chmodSync(path, 0o600);
    }

    expect(failures).toHaveLength(2);
    expect((await permissions.read("project-1", "acme.agent")).granted).toEqual(["GH_TOKEN"]);
    expect((await create().read("project-1", "acme.agent")).granted).toEqual(["GH_TOKEN"]);
    let refused: unknown;
    try {
      await permissions.authorize("project-1", source("hash-1"), ["ANTHROPIC_API_KEY"]);
    } catch (error) {
      refused = error;
    }
    expect(refused).toMatchObject({ code: "process_environment_not_granted" });
  });

  test("an unreadable grant file grants nothing instead of failing every read", async () => {
    const { permissions, path, create } = setup();
    const { sourceIdentity } = await permissions.read("project-1", "acme.agent");
    await permissions.grant("project-1", "acme.agent", { names: ["GH_TOKEN"], sourceIdentity });
    writeFileSync(path, "{ torn");

    expect((await create().read("project-1", "acme.agent")).granted).toEqual([]);
  });

  test("a temporary grant file error can be corrected without restarting the permission service", async () => {
    const { permissions, path } = setup();
    mkdirSync(path, { recursive: true });
    const failed = await permissions.read("project-1", "acme.agent").catch((error: unknown) => error);
    expect(failed).toBeInstanceOf(Error);

    rmSync(path, { recursive: true });
    writeFileSync(path, JSON.stringify({ version: 1, grants: [] }));
    expect(await permissions.read("project-1", "acme.agent")).toMatchObject({ granted: [] });
  });

  test("a grant waiting for another change still requires the source the person saw", async () => {
    const { permissions, sources, source } = setup();
    const { sourceIdentity } = await permissions.read("project-1", "acme.agent");
    await permissions.grant("project-1", "acme.agent", { names: ["GH_TOKEN"], sourceIdentity });
    const stopped = Promise.withResolvers<void>();
    const stopping = Promise.withResolvers<void>();
    const lease = await permissions.authorize("project-1", source("hash-1"), ["GH_TOKEN"]);
    startLease(lease, async () => {
      stopping.resolve();
      await stopped.promise;
    });
    const revoke = permissions.revoke("project-1", "acme.agent");
    await stopping.promise;
    const grant = permissions
      .grant("project-1", "acme.agent", { names: ["GH_TOKEN"], sourceIdentity })
      .catch((error: unknown) => error);
    // The pending stop keeps the change queued until after the source is replaced.
    await Bun.sleep(0);
    sources.set("project-1", source("hash-2"));
    stopped.resolve();

    await revoke;
    expect(await grant).toMatchObject({ code: "process_environment_source_changed" });
    expect(await permissions.read("project-1", "acme.agent")).toMatchObject({ granted: [], stale: false });
  });

  test("reading an extension the project does not have reports it as missing", async () => {
    const { permissions } = setup();

    await expect(permissions.read("project-1", "acme.other")).rejects.toMatchObject({
      code: "extension_not_found",
    });
  });
});

describe("process environment grants for host-started processes", () => {
  test("host-started processes get only the grants for their source generation", async () => {
    const { permissions, sources, source } = setup();
    const original = source("hash-1");
    const { sourceIdentity } = await permissions.read("project-1", "acme.agent");
    expect(await permissions.grantedNames("project-1", original)).toEqual([]);
    await permissions.grant("project-1", "acme.agent", { names: ["GH_TOKEN"], sourceIdentity });
    expect(await permissions.grantedNames("project-1", original)).toEqual(["GH_TOKEN"]);

    const current = source("hash-2");
    sources.set("project-1", current);
    expect(await permissions.grantedNames("project-1", current)).toEqual([]);
    const observed = await permissions.read("project-1", "acme.agent");
    await permissions.grant("project-1", "acme.agent", {
      names: ["GH_TOKEN"],
      sourceIdentity: observed.sourceIdentity,
    });
    expect(await permissions.grantedNames("project-1", current)).toEqual(["GH_TOKEN"]);

    const otherProject = await permissions.grantedNames("project-2", current).catch((error: unknown) => error);
    expect(otherProject).toMatchObject({ code: "process_environment_source_changed" });
    const oldGeneration = await permissions.grantedNames("project-1", original).catch((error: unknown) => error);
    expect(oldGeneration).toMatchObject({ code: "process_environment_source_changed" });
  });

  test("a disabled source keeps visible grant settings without process access", async () => {
    const { path, source } = setup();
    const installed = source("hash-1");
    let enabled = true;
    const permissions = createProcessEnvironmentPermissions({
      path,
      findSource: async (_project, _extension, enabledOnly) => (enabledOnly && !enabled ? undefined : installed),
    });
    const { sourceIdentity } = await permissions.read("project-1", "acme.agent");
    await permissions.grant("project-1", "acme.agent", { names: ["GH_TOKEN"], sourceIdentity });
    enabled = false;

    expect(await permissions.read("project-1", "acme.agent")).toMatchObject({ granted: ["GH_TOKEN"] });
    const result = await permissions.grantedNames("project-1", installed).catch((error: unknown) => error);
    expect(result).toMatchObject({ code: "process_environment_source_changed" });
  });
});
