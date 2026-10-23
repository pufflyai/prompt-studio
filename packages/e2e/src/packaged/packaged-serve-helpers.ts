import { type ChildProcess, spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
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

// Page loads never sign a browser in (ADR 0054). Sign in the way `pst` does: open a single-use
// login link that a bearer holder created. The dashboard stores the session before checking
// runtime readiness. Wait for that authenticated check before navigating away (ADR 0057).
export const signInBrowser = async (page: Page, descriptor: Pick<RuntimeDescriptor, "origin" | "token">) => {
  const response = await fetch(`${descriptor.origin}/runtime/browser-login`, {
    method: "POST",
    headers: runtimeAuthorization(descriptor),
  });
  if (!response.ok) throw new Error(`Browser login failed with HTTP ${response.status}`);
  const redeemed = page.waitForResponse((reply) => new URL(reply.url()).pathname === "/runtime/browser-session");
  const ready = page.waitForResponse((reply) => new URL(reply.url()).pathname === "/runtime/ready");
  await page.goto(((await response.json()) as { url: string }).url);
  const session = await redeemed;
  if (!session.ok()) throw new Error(`Browser session redemption failed with HTTP ${session.status()}`);
  const runtime = await ready;
  if (!runtime.ok()) throw new Error(`Browser authentication failed with HTTP ${runtime.status()}`);
};

export const waitForPackagedReady = async (descriptorPath: string, child: ChildProcess) =>
  waitForProcessReady(child, "Packaged runtime", async (signal) => {
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
  if (child.pid !== undefined && child.exitCode === null && child.signalCode === null) {
    child.kill();
    await new Promise((resolve) => child.once("exit", resolve));
  }
};
