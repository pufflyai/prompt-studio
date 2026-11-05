import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startPublicTextPeer } from "./packaged-public-text-peer.fixture";

test("the process bridge preserves snapshot fault controls and aborts diagnostic reads", async () => {
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
    peer = await startPublicTextPeer(root, process.execPath);
    expect(await peer.inspect()).toEqual({ documents: [], blobs: [], retainedStates: [] });
    await peer.blockDevice("third-runtime", true);
    await peer.blockDevice("third-runtime", false);
    await expect(peer.captureSnapshot("missing")).rejects.toThrow("no latest state");
    const abort = new AbortController();
    abort.abort(new Error("diagnostic cancelled"));
    await expect(peer.inspect(abort.signal)).rejects.toThrow("diagnostic cancelled");
    await peer.stop();
    await peer.restart();
    expect(await peer.inspect()).toEqual({ documents: [], blobs: [], retainedStates: [] });
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
