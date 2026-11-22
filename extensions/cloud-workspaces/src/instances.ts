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

async function controllerRunning(instance: Instance, directory: string, environment: Record<string, string>) {
  const serverFile = join(directory, "state/server.json");
  if (!(await Bun.file(serverFile).exists())) return false;
  const binary = await resolveExecutable({ binary: instance.binary }).catch(() => undefined);
  if (binary) {
    const result = await runCli(binary, directory, environment, ["server", "status", "--json"]);
    return !["not_running", "stale"].includes((JSON.parse(result.stdout) as { state: string }).state);
  }
  // A moved executable cannot report status, so only a missing recorded process proves exit.
  const { pid } = JSON.parse(await readFile(serverFile, "utf8")) as { pid: number };
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== "ESRCH";
  }
}

async function writeJson(path: string, value: unknown) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(value), { mode: 0o600 });
  await rename(temporary, path);
}

export function createInstances(root: string) {
  const directory = (id: string) => {
    if (!/^[0-9a-f-]{36}$/.test(id)) throw new Error("Invalid PocketCoder instance ID.");
    return join(root, id);
  };
  const read = async <T>(id: string, file: string) =>
    JSON.parse(await readFile(join(directory(id), file), "utf8")) as T;
  const write = (id: string, file: string, value: unknown) => writeJson(join(directory(id), file), value);
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
      // The released CLI has no JSON status before startup or after a clean stop.
      if (!(await Bun.file(join(directory(id), "state/server.json")).exists())) {
        instance.state = "stopped";
        return instance;
      }
      const result = await runCli(binary, directory(id), environment(instance), ["server", "status", "--json"]);
      const status = JSON.parse(result.stdout) as { state: string };
      if (result.exitCode === 0 && status.state === "running") instance.state = "running";
      else if (["not_running", "stale"].includes(status.state)) instance.state = "stopped";
      else throw new Error(result.stderr.trim() || `PocketCoder controller health is ${status.state ?? "unknown"}.`);
    } catch (error) {
      instance.state = "stopped";
      instance.error = String(error);
    }
    return instance;
  };
  const ownerKeys = createOwnerKeys({
    read: (id) => read<OwnerKey>(id, "owner.json"),
    // This owner key stays on the host. Provider refs and workspace files contain only IDs.
    write: (id, key) => write(id, "owner.json", key),
    create: async (instance, expiresAt) =>
      JSON.parse(await cli(instance, ["superuser", "create", "--automation", "--expires", expiresAt, "--json"])),
    get,
  });
  const start = async (id: string, binary?: string) => {
    if (binary) {
      // Check the new path before saving it, so a bad path cannot break an instance that worked before.
      const resolved = await resolveExecutable({ binary });
      const saved = await read<Instance>(id, "instance.json");
      await write(id, "instance.json", { ...saved, binary: resolved });
    }
    const instance = await get(id);
    if (instance.error) throw new Error(instance.error);
    if (instance.state === "stopped") await cli(instance, ["server", "start"]);
    await ownerKeys.issue(instance);
    if (instance.removed) await write(id, "instance.json", { ...instance, removed: false });
    return get(id);
  };
  const request = async <T>(id: string, path: string, options: RequestInit = {}) => {
    const instance = await read<Instance>(id, "instance.json");
    const token = await ownerKeys.token(id);
    const response = await fetch(`${instance.url}${path}`, {
      ...options,
      headers: { "content-type": "application/json", authorization: `Bearer ${token}`, ...options.headers },
      signal: options.signal
        ? AbortSignal.any([options.signal, AbortSignal.timeout(35_000)])
        : AbortSignal.timeout(35_000),
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
      if (!conversationId) {
        try {
          const saved = JSON.parse(await readFile(join(root, `${sessionId}.json`), "utf8"));
          if (saved.instanceId === instanceId && saved.machineId === machineId) conversationId = saved.conversationId;
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
      }
      await writeJson(join(root, `${sessionId}.json`), {
        instanceId,
        machineId,
        ...(conversationId ? { conversationId } : {}),
      });
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
      if (await controllerRunning(instance, directory(instance.id), environment(instance)))
        throw new Error("Stop the instance before removing it. Its controller process is still running.");
      // Keep the controller database and checkpoints so saved conversations and recovery data survive removal.
      await write(id, "instance.json", { ...instance, removed: true });
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
        await write(id, "instance.json", instance);
        initialized = true;
        const started = await start(id);
        for (const manifest of input.manifests ?? []) await this.publish(id, manifest);
        if (input.templates) await this.importTemplates(id, input.templates);
        return started;
      } catch (error) {
        try {
          if (initialized) await this.stop(id);
        } catch (cleanupError) {
          throw new AggregateError(
            [error, cleanupError],
            `PocketCoder launch failed and its controller could not be confirmed stopped. Recovery state remains at ${directory(id)}.`,
          );
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
      if (instance.error) throw new Error(instance.error);
      if (instance.state === "running") await cli(instance, ["server", "stop"]);
      const stopped = await get(id);
      if (stopped.error) throw new Error(stopped.error);
      if (stopped.state !== "stopped") throw new Error("PocketCoder controller is still running.");
      return stopped;
    },
  };
}
