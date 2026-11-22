import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { resolveExecutable } from "./executable";
import { inputEnvironment, instanceLimits } from "./instance-inputs";
import { runCli } from "./local-cli";
import { createOwnerKeys, type OwnerKey } from "./owner-keys";

export interface Instance {
  id: string;
  name: string;
  binary: string;
  url: string;
  agentPort: number;
  state: "running" | "stopped";
  error?: string;
  workloadLimits?: Record<string, number>;
  removed?: boolean;
}

interface InstanceLaunchInput {
  name: string;
  binary?: string;
  projectRoot?: string;
  templates?: string;
  manifests?: unknown[];
}

export class PocketCoderHttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(`PocketCoder HTTP ${status}: ${code}: ${message}`);
  }
}

export const instancesFor = (projectId: string) =>
  createInstances(join(homedir(), ".local", "share", "pocketcoder-pstdio", projectId));

export function createInstances(root: string) {
  const directory = (id: string) => {
    if (!/^[0-9a-f-]{36}$/.test(id)) throw new Error("Invalid PocketCoder instance ID.");
    return join(root, id);
  };
  const read = async <T>(id: string, file: string) =>
    JSON.parse(await readFile(join(directory(id), file), "utf8")) as T;
  // Replace files atomically so a concurrent reader never sees a partial file.
  const write = async (path: string, value: unknown) => {
    const temporary = `${path}.${randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify(value), { mode: 0o600 });
    await rename(temporary, path);
  };
  const environment = (instance: Instance) => ({
    POCKETCODER_DIR: join(directory(instance.id), "data"),
    POCKETCODER_STATE_DIR: join(directory(instance.id), "state"),
    POCKETCODER_HTTP: new URL(instance.url).host,
    POCKETCODER_AGENT_HTTP: `0.0.0.0:${instance.agentPort}`,
    POCKETCODER_WORKSPACE_SERVER_URL: `http://host.docker.internal:${instance.agentPort}`,
    POCKETCODER_STORAGE_BACKEND: "filesystem",
    POCKETCODER_WORKSPACE_DATA_DIR: join(directory(instance.id), "workspaces"),
    POCKETCODER_CHECKPOINT_DIR: join(directory(instance.id), "checkpoints"),
    ...(instance.workloadLimits ? inputEnvironment(directory(instance.id), instance.workloadLimits) : {}),
  });
  const cli = async (instance: Instance, args: string[], extra: Record<string, string> = {}) => {
    const result = await runCli(instance.binary, directory(instance.id), { ...environment(instance), ...extra }, args);
    if (result.exitCode !== 0) throw new Error(result.stderr.trim() || `PocketCoder ${args[0]} failed.`);
    return result.stdout;
  };
  const get = async (id: string) => {
    const instance = await read<Instance>(id, "instance.json");
    try {
      const binary = await resolveExecutable({ binary: instance.binary });
      const result = await runCli(binary, directory(id), environment(instance), ["server", "status", "--json"]);
      const reported = /"state":\s*"(\w+)"/.exec(result.stdout)?.[1];
      // The CLI exits 0 only for a healthy controller. Only a reported exit proves a stop; an unhealthy,
      // timed-out or failed status check leaves the controller state unknown.
      instance.state = result.exitCode === 0 ? "running" : "stopped";
      if (result.exitCode !== 0 && reported !== "not_running" && reported !== "stale")
        instance.error = `Controller status: ${reported ?? (result.stderr.trim() || "unknown")}.`;
    } catch (error) {
      instance.state = "stopped";
      instance.error = String(error);
    }
    return instance;
  };
  const controllerRunning = async (instance: Instance) => {
    const instanceDirectory = directory(instance.id);
    const serverFile = join(instanceDirectory, "state/server.json");
    if (!(await Bun.file(serverFile).exists())) return false;
    const binary = await resolveExecutable({ binary: instance.binary }).catch(() => undefined);
    if (binary) {
      const result = await runCli(binary, instanceDirectory, environment(instance), ["server", "status", "--json"]);
      return !["not_running", "stale"].includes((JSON.parse(result.stdout) as { state: string }).state);
    }
    // A moved or deleted executable cannot report status, so check the recorded process directly.
    // Otherwise the instance could be neither started nor removed.
    const { pid } = JSON.parse(await readFile(serverFile, "utf8")) as { pid: number };
    try {
      process.kill(pid, 0);
      return true;
    } catch (error) {
      // EPERM means the process exists but belongs to another user, so only ESRCH proves it exited.
      return (error as NodeJS.ErrnoException).code !== "ESRCH";
    }
  };
  const ownerKeys = createOwnerKeys({
    read: (id) => read<OwnerKey>(id, "owner.json"),
    // This owner key stays on the host. Provider refs and workspace files contain only IDs.
    write: (id, key) => write(join(directory(id), "owner.json"), key),
    create: async (instance, expiresAt) =>
      JSON.parse(await cli(instance, ["superuser", "create", "--automation", "--expires", expiresAt, "--json"])),
    get,
  });
  const start = async (id: string, binary?: string) => {
    if (binary) {
      // Check the new path before saving it, so a bad path cannot break an instance that worked before.
      const resolved = await resolveExecutable({ binary });
      const saved = await read<Instance>(id, "instance.json");
      await write(join(directory(id), "instance.json"), { ...saved, binary: resolved });
    }
    const instance = await get(id);
    if (instance.error) throw new Error(instance.error);
    if (instance.state === "stopped") await cli(instance, ["server", "start"]);
    await ownerKeys.issue(instance);
    if (instance.removed) await write(join(directory(id), "instance.json"), { ...instance, removed: false });
    return get(id);
  };
  const request = async <T>(id: string, path: string, options: RequestInit = {}) => {
    const instance = await read<Instance>(id, "instance.json");
    const token = await ownerKeys.token(id);
    // A caller's cancellation signal has no deadline, so it must not replace the one for a stalled controller.
    const deadline = AbortSignal.timeout(35_000);
    const response = await fetch(`${instance.url}${path}`, {
      ...options,
      headers: { "content-type": "application/json", authorization: `Bearer ${token}`, ...options.headers },
      signal: options.signal ? AbortSignal.any([options.signal, deadline]) : deadline,
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
      throw new PocketCoderHttpError(
        response.status,
        body?.error?.code ?? "http_error",
        body?.error?.message ?? response.statusText,
      );
    }
    return response.json() as Promise<T>;
  };
  return {
    async bindSession(sessionId: string, instanceId: string, machineId: string, conversationId?: string) {
      directory(sessionId);
      directory(instanceId);
      directory(machineId);
      const path = join(root, `${sessionId}.json`);
      if (!conversationId) {
        try {
          const saved = JSON.parse(await readFile(path, "utf8"));
          if (saved.instanceId === instanceId && saved.machineId === machineId) conversationId = saved.conversationId;
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
      }
      await write(path, { instanceId, machineId, ...(conversationId ? { conversationId } : {}) });
    },
    async sessionTarget(sessionId: string) {
      directory(sessionId);
      return JSON.parse(await readFile(join(root, `${sessionId}.json`), "utf8")) as {
        instanceId: string;
        machineId: string;
        conversationId?: string;
      };
    },
    get,
    start,
    request,
    async connection(id: string) {
      try {
        await request(id, "/v1/templates?limit=1", { signal: AbortSignal.timeout(2_000) });
        return "Connected";
      } catch {
        return "Unreachable";
      }
    },
    async items<T>(id: string, path: string) {
      const items: T[] = [];
      let cursor: string | null = null;
      do {
        const query = new URLSearchParams({ limit: "200" });
        if (cursor) query.set("cursor", cursor);
        const page: { items: T[]; next_cursor: string | null } = await request(id, `${path}?${query}`);
        items.push(...page.items);
        cursor = page.next_cursor;
      } while (cursor);
      return items;
    },
    async list() {
      await mkdir(root, { recursive: true, mode: 0o700 });
      const entries = await readdir(root, { withFileTypes: true });
      const saved = await Promise.all(
        entries.filter((entry) => entry.isDirectory()).map((entry) => read<Instance>(entry.name, "instance.json")),
      );
      return Promise.all(saved.filter((instance) => !instance.removed).map((instance) => get(instance.id)));
    },
    async remove(id: string) {
      const instance = await read<Instance>(id, "instance.json");
      if (await controllerRunning(instance))
        throw new Error("Stop the instance before removing it. Its controller process is still running.");
      // Keep the controller database and checkpoints so saved conversations and recovery data survive removal.
      await write(join(directory(id), "instance.json"), { ...instance, removed: true });
    },
    async launch(input: InstanceLaunchInput, allocatePort: () => Promise<number>) {
      const workloadLimits = instanceLimits(input.manifests ?? []);
      const binary = await resolveExecutable(input);
      const id = randomUUID();
      await mkdir(directory(id), { recursive: true, mode: 0o700 });
      let initialized = false;
      try {
        await writeFile(join(directory(id), "empty.env"), "", { mode: 0o600 });
        const operatorPort = await allocatePort();
        let agentPort = await allocatePort();
        while (agentPort === operatorPort) agentPort = await allocatePort();
        const instance: Instance = {
          id,
          name: input.name,
          binary,
          url: `http://127.0.0.1:${operatorPort}`,
          agentPort,
          state: "stopped",
          ...(workloadLimits ? { workloadLimits } : {}),
        };
        await write(join(directory(id), "instance.json"), instance);
        initialized = true;
        const started = await start(id);
        for (const manifest of input.manifests ?? []) await this.publish(id, manifest);
        if (input.templates) await this.importTemplates(id, input.templates);
        return started;
      } catch (error) {
        if (initialized) {
          await this.stop(id);
          // A failed status probe also reads as stopped, so keep the state unless the controller is confirmed gone.
          if (await controllerRunning(await read<Instance>(id, "instance.json")).catch(() => true)) throw error;
        }
        await rm(directory(id), { recursive: true });
        throw error;
      }
    },
    async publishedTemplates(id: string) {
      const templates = await this.items<{ name: string; version: string; status: string; description?: string }>(
        id,
        "/v1/templates",
      );
      return templates.filter((template) => template.status !== "retired");
    },
    async retire(id: string, name: string, version: string) {
      // The controller keeps the snapshot that existing machines of this version use.
      await request(id, `/v1/templates/${encodeURIComponent(name)}/${encodeURIComponent(version)}`, {
        method: "DELETE",
      });
    },
    async publish(id: string, manifest: unknown) {
      await request(id, "/v1/templates", { method: "POST", body: JSON.stringify({ manifest }) });
    },
    async importTemplates(id: string, templates: string) {
      const instance = await get(id);
      const owner = await read<{ token: string }>(id, "owner.json");
      await cli(instance, ["templates", "import", templates], {
        POCKETCODER_URL: instance.url,
        POCKETCODER_KEY: owner.token,
      });
    },
    async stop(id: string) {
      const instance = await get(id);
      if (instance.state === "running") await cli(instance, ["server", "stop"]);
      return get(id);
    },
  };
}
