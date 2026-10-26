import { type ChildProcess, spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { stopChildProcess } from "../scripts/child-process";
import { registerPendingTestProcess } from "../scripts/pending-test-processes";
import { waitForProcessReady } from "../scripts/process-readiness";
import { PACKAGED_BINARY_PATH } from "./packaged-helpers";

export type RuntimeDescriptor = {
  pid: number;
  instanceId: string;
  ownerType: "desktop" | "persistent";
  origin: string;
  token: string;
  protocolVersion: number;
};

export const runtimeAuthorization = (descriptor: Pick<RuntimeDescriptor, "token">) => ({
  authorization: `Bearer ${descriptor.token}`,
});

// The fixture owns each child's control channel. Windows process signals cannot
// run runtime cleanup, so callers stop it through the descriptor published at readiness.
const runtimeClosers = new WeakMap<ChildProcess, () => Promise<void>>();

// Page loads never sign a browser in (ADR 0054). Sign in the way `pst` does: open a single-use
// login link that a bearer holder created. The dashboard stores the session before checking
// runtime readiness. Wait for that authenticated check before navigating away (ADR 0057).
export const signInBrowser = async (
  page: Page,
  descriptor: Pick<RuntimeDescriptor, "origin" | "token">,
  path = "/",
) => {
  const response = await fetch(`${descriptor.origin}/runtime/browser-login`, {
    method: "POST",
    headers: runtimeAuthorization(descriptor),
  });
  if (!response.ok) throw new Error(`Browser login failed with HTTP ${response.status}`);
  const redeemed = page.waitForResponse((reply) => new URL(reply.url()).pathname === "/runtime/browser-session");
  const ready = page.waitForResponse((reply) => new URL(reply.url()).pathname === "/runtime/ready");
  const url = new URL(((await response.json()) as { url: string }).url);
  url.pathname = path;
  await page.goto(url.href);
  const session = await redeemed;
  if (!session.ok()) throw new Error(`Browser session redemption failed with HTTP ${session.status()}`);
  const runtime = await ready;
  if (!runtime.ok()) throw new Error(`Browser authentication failed with HTTP ${runtime.status()}`);
};

export const waitForPackagedReady = async (descriptorPath: string, child: ChildProcess) => {
  const descriptor = await waitForProcessReady(child, "Packaged runtime", async (signal) => {
    if (!existsSync(descriptorPath)) return;
    const descriptor = JSON.parse(readFileSync(descriptorPath, "utf8")) as RuntimeDescriptor;
    const res = await fetch(`${descriptor.origin}/runtime/ready`, {
      headers: runtimeAuthorization(descriptor),
      signal,
    });
    const ready = res.ok ? ((await res.json()) as { instanceId: string; protocolVersion: number }) : null;
    if (
      descriptor.pid === child.pid &&
      descriptor.ownerType === "persistent" &&
      descriptor.origin.startsWith("http://127.0.0.1:") &&
      ready?.instanceId === descriptor.instanceId &&
      ready.protocolVersion === descriptor.protocolVersion
    )
      return descriptor;
  });
  let closed = false;
  let closing: Promise<void> | undefined;
  const close = async () => {
    const lifetime = registerPendingTestProcess(child);
    try {
      if (child.exitCode === null && child.signalCode === null) {
        const response = await fetch(`${descriptor.origin}/runtime/shutdown`, {
          method: "POST",
          headers: { ...runtimeAuthorization(descriptor), "content-type": "application/json" },
          body: JSON.stringify({ instanceId: descriptor.instanceId, force: true }),
          signal: lifetime.signal,
        });
        if (response.status !== 202) throw new Error(`Runtime shutdown failed with HTTP ${response.status}`);
      }
      if (!closed) await once(child, "close", { signal: lifetime.signal });
    } catch (error) {
      await stopChildProcess(child);
      throw error;
    } finally {
      lifetime.finish();
    }
  };
  runtimeClosers.set(child, () => (closing ??= close()));
  child.once("close", () => {
    closed = true;
    runtimeClosers.delete(child);
  });
  return descriptor;
};

export const startPackagedServe = async (
  tempRoot: string,
  env: Record<string, string> = {},
  binaryPath = PACKAGED_BINARY_PATH,
) => {
  const descriptorPath = join(tempRoot, "runtime.json");
  const {
    PSTDIO_EXTENSION_SOURCE_ROOT: _sourceRoot,
    PSTDIO_EXTENSION_RELEASE_REF: _releaseRef,
    ...runtimeEnv
  } = process.env;
  const child = spawn(
    binaryPath,
    ["serve", "--foreground", "--owner", "persistent", "--host", "127.0.0.1", "--port", "0"],
    {
      // Run outside the repo root so runtime file access cannot rely on local workspace paths.
      cwd: tempRoot,
      env: {
        ...runtimeEnv,
        HOME: tempRoot,
        PSTDIO_HOME: tempRoot,
        PSTDIO_DB_PATH: join(tempRoot, "db.sqlite"),
        PSTDIO_DEFAULT_EXTENSIONS: "[]",
        PSTDIO_STORAGE_PATH: join(tempRoot, "storage"),
        ...env,
      },
      stdio: "pipe",
    },
  );
  try {
    const descriptor = await waitForPackagedReady(descriptorPath, child);
    return { child, baseUrl: descriptor.origin, descriptor };
  } catch (error) {
    await stopProcess(child);
    throw error;
  }
};

export const stopProcess = async (child: ChildProcess) => {
  const close = runtimeClosers.get(child);
  if (close) await close();
  else await stopChildProcess(child);
};
