import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startPublicTextPeer } from "./packaged-public-text-peer.fixture";

test("the process bridge preserves snapshot fault controls and aborts diagnostic reads", async () => {
  const startedAt = performance.now();
  const phase = (name: string) =>
    console.info(`Cloud peer bridge +${Math.round(performance.now() - startedAt)}ms: ${name}`);
  const root = mkdtempSync(join(tmpdir(), "cloud-peer-bridge-"));
  let peer: Awaited<ReturnType<typeof startPublicTextPeer>> | undefined;
  const failures: unknown[] = [];
  try {
    execFileSync(
      "openssl",
      [
        "req",
        "-x509",
        "-newkey",
        "rsa:2048",
        "-nodes",
        "-keyout",
        join(root, "peer-key.pem"),
        "-out",
        join(root, "peer-cert.pem"),
        "-days",
        "1",
        "-subj",
        "/CN=localhost",
      ],
      { stdio: "pipe" },
    );
    // Test the IPC boundary with local Bun; this is not a packaged-host acceptance result.
    phase("certificate created; start peer");
    peer = await startPublicTextPeer(root, process.execPath);
    phase("peer ready; inspect");
    expect(await peer.inspect()).toEqual({ documents: [], blobs: [], retainedStates: [] });
    phase("inspect complete; exercise device controls");
    await peer.blockDevice("third-runtime", true);
    await peer.blockDevice("third-runtime", false);
    phase("device controls complete; capture missing snapshot");
    // Await process I/O before invoking Bun's synchronous rejection matcher. On
    // Windows the matcher can leave the child's pipe unread until test teardown (ADR 0135).
    const snapshotError = await peer.captureSnapshot("missing").then(
      () => undefined,
      (error: unknown) => error,
    );
    phase("missing snapshot rejected at process bridge");
    expect(snapshotError).toBeInstanceOf(Error);
    expect((snapshotError as Error).message).toContain("no latest state");
    const abort = new AbortController();
    abort.abort(new Error("diagnostic cancelled"));
    await expect(peer.inspect(abort.signal)).rejects.toThrow("diagnostic cancelled");
    phase("snapshot and abort controls complete; stop peer");
    await peer.stop();
    phase("peer stopped; restart");
    await peer.restart();
    expect(await peer.inspect()).toEqual({ documents: [], blobs: [], retainedStates: [] });
    phase("restart inspected; close process");
  } catch (error) {
    failures.push(error);
  } finally {
    await peer?.close().catch((error) => failures.push(error));
    try {
      rmSync(root, { recursive: true, force: true });
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length) throw new AggregateError(failures, "Cloud peer bridge or cleanup failed");
});
