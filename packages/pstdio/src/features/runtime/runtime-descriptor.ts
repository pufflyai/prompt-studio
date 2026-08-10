import { randomUUID } from "node:crypto";
import {
  chmodSync,
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";
import { withRuntimeDescriptorLock } from "./runtime-descriptor-lock";

export type RuntimeOwnerType = "desktop" | "persistent";

export interface RuntimeDescriptor {
  schemaVersion: 1;
  protocolVersion: 1;
  pid: number;
  instanceId: string;
  ownerType: RuntimeOwnerType;
  origin: `http://127.0.0.1:${number}`;
  token: string;
  appVersion: string;
  startedAt: string;
}

type RuntimeReadyResponse = {
  ok: true;
  protocolVersion: 1;
  instanceId: string;
  ownerType: RuntimeOwnerType;
};

type RuntimeFetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

type DiscoverRuntimeDeps = {
  fetch: RuntimeFetcher;
  isPidAlive: (pid: number) => boolean;
};

export type RuntimeDiscovery =
  | { state: "missing" }
  | { state: "healthy"; descriptor: RuntimeDescriptor }
  | { state: "unsafe"; reason: "invalid_descriptor" | "ownership_uncertain" };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isOwnerType = (value: unknown): value is RuntimeOwnerType => value === "desktop" || value === "persistent";

const isLoopbackOrigin = (value: unknown): value is RuntimeDescriptor["origin"] => {
  if (typeof value !== "string") return false;
  const match = /^http:\/\/127\.0\.0\.1:(\d{1,5})$/.exec(value);
  if (!match) return false;
  const port = Number(match[1]);
  return port >= 1 && port <= 65_535;
};

const isIsoDate = (value: unknown) => {
  if (typeof value !== "string") return false;
  const date = new Date(value);
  return !Number.isNaN(date.valueOf()) && date.toISOString() === value;
};

export const parseRuntimeDescriptor = (value: unknown): RuntimeDescriptor | null => {
  if (!isRecord(value)) return null;
  if (value.schemaVersion !== 1 || value.protocolVersion !== 1) return null;
  if (!Number.isInteger(value.pid) || (value.pid as number) < 1) return null;
  if (typeof value.instanceId !== "string" || !value.instanceId) return null;
  if (!isOwnerType(value.ownerType) || !isLoopbackOrigin(value.origin)) return null;
  if (typeof value.token !== "string" || !value.token) return null;
  if (typeof value.appVersion !== "string" || !value.appVersion) return null;
  if (!isIsoDate(value.startedAt)) return null;
  return value as unknown as RuntimeDescriptor;
};

const readDescriptorValue = (path: string) => {
  if (!existsSync(path)) return { state: "missing" as const };

  try {
    return { state: "present" as const, value: JSON.parse(readFileSync(path, "utf8")) as unknown };
  } catch {
    return { state: "invalid" as const };
  }
};

export const readRuntimeDescriptor = (path: string) => {
  const result = readDescriptorValue(path);
  if (result.state !== "present") return null;
  return parseRuntimeDescriptor(result.value);
};

const writeRuntimeDescriptorUnlocked = (path: string, descriptor: RuntimeDescriptor) => {
  const parent = dirname(path);
  mkdirSync(parent, { recursive: true, mode: 0o700 });
  const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`;
  const fd = openSync(temporaryPath, "wx", 0o600);

  try {
    writeFileSync(fd, `${JSON.stringify(descriptor, null, 2)}\n`, "utf8");
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }

  renameSync(temporaryPath, path);
  chmodSync(path, 0o600);
};

const isMatchingRuntime = (
  descriptor: RuntimeDescriptor | null,
  identity: Pick<RuntimeDescriptor, "pid" | "instanceId">,
): descriptor is RuntimeDescriptor => descriptor?.pid === identity.pid && descriptor.instanceId === identity.instanceId;

export const writeRuntimeDescriptor = (path: string, descriptor: RuntimeDescriptor) =>
  withRuntimeDescriptorLock(path, () => writeRuntimeDescriptorUnlocked(path, descriptor));

export const promoteRuntimeDescriptor = (path: string, identity: Pick<RuntimeDescriptor, "pid" | "instanceId">) =>
  withRuntimeDescriptorLock(path, () => {
    const current = readRuntimeDescriptor(path);
    if (!isMatchingRuntime(current, identity)) return null;
    if (current.ownerType === "persistent") return current;

    const promoted: RuntimeDescriptor = { ...current, ownerType: "persistent" };
    writeRuntimeDescriptorUnlocked(path, promoted);
    return promoted;
  });

export const cleanupRuntimeDescriptor = (path: string, identity: Pick<RuntimeDescriptor, "pid" | "instanceId">) =>
  withRuntimeDescriptorLock(path, () => {
    const current = readRuntimeDescriptor(path);
    if (!isMatchingRuntime(current, identity)) return false;
    unlinkSync(path);
    return true;
  });

export const isRuntimePidAlive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== "ESRCH";
  }
};

const parseReadyResponse = (value: unknown): RuntimeReadyResponse | null => {
  if (!isRecord(value)) return null;
  if (value.ok !== true || value.protocolVersion !== 1) return null;
  if (typeof value.instanceId !== "string" || !isOwnerType(value.ownerType)) return null;
  return value as RuntimeReadyResponse;
};

const probeRuntime = async (descriptor: RuntimeDescriptor, fetcher: RuntimeFetcher) => {
  try {
    const response = await fetcher(`${descriptor.origin}/runtime/ready`, {
      headers: { authorization: `Bearer ${descriptor.token}` },
    });
    if (!response.ok) return false;
    const ready = parseReadyResponse(await response.json());
    return ready?.instanceId === descriptor.instanceId;
  } catch {
    return false;
  }
};

export const discoverRuntime = async (
  path: string,
  overrides: Partial<DiscoverRuntimeDeps> = {},
): Promise<RuntimeDiscovery> => {
  const raw = readDescriptorValue(path);
  if (raw.state === "missing") return { state: "missing" };
  if (raw.state === "invalid") return { state: "unsafe", reason: "invalid_descriptor" };

  const descriptor = parseRuntimeDescriptor(raw.value);
  if (!descriptor) return { state: "unsafe", reason: "invalid_descriptor" };

  const pidAlive = (overrides.isPidAlive ?? isRuntimePidAlive)(descriptor.pid);
  const ready = await probeRuntime(descriptor, overrides.fetch ?? fetch);
  if (pidAlive && ready) return { state: "healthy", descriptor };
  if (pidAlive || ready) return { state: "unsafe", reason: "ownership_uncertain" };

  cleanupRuntimeDescriptor(path, descriptor);
  return { state: "missing" };
};
