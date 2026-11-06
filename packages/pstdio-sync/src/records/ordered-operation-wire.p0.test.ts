import { expect, test } from "bun:test";
import { fingerprint, type Json } from "pstdio-sync-contracts";
import { prepareOrderedOperation } from "./ordered-operation";
import { verifyOrderedAdmission, verifyOrderedOperation } from "./ordered-operation-wire";

test("an ordered envelope survives JSON transport with literal keys and its exact identity", async () => {
  const value = JSON.parse('{"__proto__":{"safe":true},"a/b":"\\u0000😀"}');
  const input = await prepareOrderedOperation(
    { operationId: "save", edits: [{ recordId: "card", replace: value }] },
    new Map(),
  );
  expect(await verifyOrderedOperation(JSON.parse(JSON.stringify(input)))).toEqual(input);
  await expect(
    verifyOrderedOperation({ ...input, edits: [{ recordId: "card", changes: [{ path: [], set: "tampered" }] }] }),
  ).rejects.toThrow("identity");
});

test("even a correctly hashed envelope refuses duplicate records and overlapping paths before apply", async () => {
  for (const [index, edits] of [
    [
      { recordId: "card", changes: [{ path: [], set: 1 }] },
      { recordId: "card", changes: [{ path: [], set: 2 }] },
    ],
    [
      {
        recordId: "card",
        changes: [
          { path: ["config"], set: {} },
          { path: ["config", "model"], set: "small" },
        ],
      },
    ],
  ].entries()) {
    const body = { version: 1, operationId: "invalid", edits };
    await expect(verifyOrderedOperation({ ...body, fingerprint: await fingerprint(body as Json) })).rejects.toThrow(
      index === 0 ? "name each record once" : "overlapping",
    );
  }
});

test("unknown operation fields and malformed observations cannot be accepted by an older decoder", async () => {
  const input = await prepareOrderedOperation(
    { operationId: "save", edits: [{ recordId: "card", replace: "value" }] },
    new Map(),
  );
  await expect(verifyOrderedOperation({ ...input, inventedRule: true })).rejects.toThrow("Unknown ordered field");
  const body = {
    version: 1,
    operationId: "invalid",
    edits: [
      {
        recordId: "card",
        changes: [{ path: [], set: true }],
        condition: {
          version: 1,
          exists: true,
          deleted: false,
          lifetime: "initial",
          value: { kind: "value", digest: "bad" },
          stamps: {},
        },
      },
    ],
  };
  await expect(verifyOrderedOperation({ ...body, fingerprint: await fingerprint(body as Json) })).rejects.toThrow(
    "fingerprint",
  );
});

test("admission dependencies reject unknown semantics, duplicate identities and invalid fingerprints", async () => {
  const operation = await prepareOrderedOperation(
    { operationId: "save", edits: [{ recordId: "card", replace: true }] },
    new Map(),
  );
  const dependency = { operationId: "parent", epoch: "epoch", fingerprint: operation.fingerprint };
  const admission = { epoch: "epoch", operation, dependencies: [dependency] };
  await expect(verifyOrderedAdmission({ ...admission, inventedRule: true })).rejects.toThrow("Unknown ordered field");
  await expect(verifyOrderedAdmission({ ...admission, dependencies: [dependency, dependency] })).rejects.toThrow(
    "Duplicate ordered dependency",
  );
  await expect(
    verifyOrderedAdmission({ ...admission, dependencies: [{ ...dependency, fingerprint: "invalid" }] }),
  ).rejects.toThrow("fingerprint");
});
