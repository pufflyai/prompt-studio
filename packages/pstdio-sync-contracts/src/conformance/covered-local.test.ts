import { expect, test } from "bun:test";
import { sealCheckpoint } from "../checkpoint";
import { reconcileCoveredLocal } from "./covered-local";
import { newCoveredState } from "./covered-state";

for (const complete of [true, false])
  test(`matching records preserve pending recovery with complete bytes ${complete}`, async () => {
    const scope = { accountId: "a", workbenchId: "w", extensionId: "e" };
    const local = newCoveredState(scope);
    const remote = newCoveredState(scope);
    const bytes = new TextEncoder().encode("pending");
    const asset = {
      sha256: new Bun.CryptoHasher("sha256").update(bytes).digest("hex"),
      byteLength: bytes.length,
      mediaType: "text/plain",
    };
    const group = await sealCheckpoint({
      protocolVersion: 2,
      scope,
      epoch: local.epoch,
      generation: 0,
      environmentId: "b",
      sequence: 1,
      parents: [],
      document: { recordId: "doc", generation: 0, recoveryRevision: 1 },
      changes: [
        { recordId: "doc", expectedRevision: 0, baseDeleted: false, shared: { kind: "text", update: "AAA=" } },
        { recordId: "projection", expectedRevision: 0, baseDeleted: false, asset: { base: null, next: asset } },
      ],
    });
    local.receipts["b:1"] = { group, status: "pending", cut: null };
    const result = await reconcileCoveredLocal(
      {
        snapshot: local,
        branches: [],
        blobs: complete ? [{ asset, bytes: Buffer.from(bytes).toString("base64") }] : [],
      },
      remote,
    );
    expect(result.status).toBe(complete ? "recovery-proposal" : "recovery-unavailable");
  });
