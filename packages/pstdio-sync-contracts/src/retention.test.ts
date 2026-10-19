import { expect, test } from "bun:test";
import { type CoveredSnapshot, coveredAssetClosure } from "./retention";

test("compacted recovery retains each asset descriptor when bytes have multiple media types", () => {
  const first = { sha256: "a".repeat(64), byteLength: 3, mediaType: "text/plain" };
  const second = { ...first, mediaType: "image/png" };
  const snapshot: CoveredSnapshot = {
    protocolVersion: 2,
    scope: { accountId: "account", workbenchId: "workbench", extensionId: "extension" },
    epoch: "restore-epoch",
    generation: 1,
    cut: 2,
    covered: 2,
    records: Object.fromEntries(
      [first, second].map((asset, index) => [
        String(index),
        {
          recordId: String(index),
          primitive: null,
          map: {},
          revision: index + 1,
          deleted: false,
          value: null,
          asset,
        },
      ]),
    ),
    conflicts: {},
    publishedRevision: "package",
    documents: {},
    receipts: {},
    writers: { writer: { floor: 2 } },
    retainedBranches: [],
  };
  expect(coveredAssetClosure(snapshot)).toEqual([first, second]);
});
