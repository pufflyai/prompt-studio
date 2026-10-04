import { afterEach, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { connect } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { readPerformanceEndpointDescriptor, resolvePstdioPerformanceEndpoint } from "pstdio-paths";
import { runWindowsPowerShell } from "../cli/windows-user-path";
import { openPerformanceEndpoint } from "./performance-endpoint";

const roots: string[] = [];
const endpointPath = () => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-perf-"));
  roots.push(root);
  return resolvePstdioPerformanceEndpoint({ env: { PSTDIO_HOME: root } });
};

const read = async (path: string, credential?: string) => {
  const descriptor = readPerformanceEndpointDescriptor(path);
  if (!descriptor) return null;
  return new Promise<unknown>((resolve, reject) => {
    const socket = connect(descriptor.port, "127.0.0.1");
    let body = "";
    socket.setEncoding("utf8");
    socket.on("connect", () => socket.write(`${credential ?? descriptor.token}\n`));
    socket.on("data", (chunk: string) => {
      body += chunk;
    });
    socket.on("end", () => resolve(body ? JSON.parse(body) : null));
    socket.on("error", reject);
  });
};

afterEach(() => {
  for (const root of roots) rmSync(root, { force: true, recursive: true });
  roots.length = 0;
});

describe("performance endpoint", () => {
  test("does not read a snapshot for a connection without its credential", async () => {
    const path = endpointPath();
    let reads = 0;
    const endpoint = await openPerformanceEndpoint(path, () => ({ reads: ++reads }));
    try {
      expect(await read(path, "wrong-token")).toBeNull();
      expect(await read(path, "")).toBeNull();
      expect(reads).toBe(0);
    } finally {
      await endpoint.close();
    }
  });

  test("answers authenticated local connections and removes credentials when closed", async () => {
    const path = endpointPath();
    let reads = 0;
    const endpoint = await openPerformanceEndpoint(path, () => ({ reads: ++reads }));
    try {
      expect(await read(path)).toEqual({ reads: 1 });
      expect(await read(path)).toEqual({ reads: 2 });
      if (process.platform !== "win32") {
        expect(statSync(path).mode & 0o777).toBe(0o600);
        expect(statSync(dirname(path)).mode & 0o777).toBe(0o700);
      }
    } finally {
      await endpoint.close();
    }
    expect(existsSync(path)).toBe(false);
    expect(await read(path)).toBeNull();
  });

  test("closes even when a client never authenticates or closes its side", async () => {
    const path = endpointPath();
    const endpoint = await openPerformanceEndpoint(path, () => ({ ok: true }));
    const descriptor = readPerformanceEndpointDescriptor(path)!;
    const client = connect({ port: descriptor.port, host: "127.0.0.1", allowHalfOpen: true });
    await new Promise((resolve) => client.once("connect", resolve));
    const closed = await Promise.race([
      endpoint.close().then(() => "closed"),
      new Promise((resolve) => setTimeout(() => resolve("stalled"), 1_000)),
    ]);
    client.destroy();
    expect(closed).toBe("closed");
  });

  test("preserves an active owner and rotates credentials when reopened", async () => {
    const path = endpointPath();
    const endpoint = await openPerformanceEndpoint(path, () => ({ ok: true }));
    const first = readPerformanceEndpointDescriptor(path)!;
    await expect(openPerformanceEndpoint(path, () => null)).rejects.toThrow("Another app");
    expect(await read(path)).toEqual({ ok: true });
    await endpoint.close();
    const restarted = await openPerformanceEndpoint(path, () => ({ restarted: true }));
    try {
      expect(readPerformanceEndpointDescriptor(path)?.token).not.toBe(first.token);
      expect(await read(path, first.token)).toBeNull();
      expect(await read(path)).toEqual({ restarted: true });
    } finally {
      await restarted.close();
    }
  });

  test.skipIf(process.platform !== "win32")("Windows grants credential access only to the current user", async () => {
    const path = endpointPath();
    const endpoint = await openPerformanceEndpoint(path, () => ({ ok: true }));
    try {
      const identity = execFileSync("whoami", ["/user", "/fo", "csv", "/nh"], { encoding: "utf8" });
      const sid = identity.match(/S-1-5-\d+(?:-\d+)+/)![0]!;
      const targets = [
        [dirname(path), "Directory"],
        [path, "File"],
      ] as const;
      for (const [target, kind] of targets) {
        const output = await runWindowsPowerShell(
          `
$acl = [System.IO.${kind}]::GetAccessControl($env:PSTDIO_ACL_TEST_PATH)
$rules = $acl.GetAccessRules($true, $true, [System.Security.Principal.SecurityIdentifier])
foreach ($rule in $rules) { [Console]::WriteLine($rule.IdentityReference.Value) }
`,
          { PSTDIO_ACL_TEST_PATH: target },
        );
        expect(output.split(/\r?\n/)).toEqual([sid]);
      }
      expect(await read(path)).toEqual({ ok: true });
      expect(await read(path, "wrong-token")).toBeNull();
    } finally {
      await endpoint.close();
    }
  });
});

test("an oversized credential cannot keep feeding a rejected connection", async () => {
  const root = mkdtempSync(join(tmpdir(), "performance-rejected-client-"));
  const path = join(root, "access", "endpoint.json");
  const endpoint = await openPerformanceEndpoint(path, () => ({ secret: "snapshot" }));
  const { port } = JSON.parse(readFileSync(path, "utf8"));
  const client = connect({ port, host: "127.0.0.1", allowHalfOpen: true });
  client.on("error", () => {});
  const closed = new Promise<string>((resolve) => client.once("close", () => resolve("closed")));
  const ended = new Promise<void>((resolve) => client.once("end", resolve));
  client.resume();
  try {
    await new Promise((resolve) => client.once("connect", resolve));
    client.write("x".repeat(512));
    await ended;
    // TCP permits the rejected client to keep sending after receiving the server FIN.
    client.write("x".repeat(512));
    expect(
      await Promise.race([closed, new Promise<string>((resolve) => setTimeout(() => resolve("still accepted"), 100))]),
    ).toBe("closed");
  } finally {
    client.destroy();
    await endpoint.close();
    rmSync(root, { recursive: true, force: true });
  }
});
