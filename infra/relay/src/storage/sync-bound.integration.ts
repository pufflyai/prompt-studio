import { afterAll, beforeAll, expect, test } from "bun:test";
import { createSyncFixture, encode, randomId } from "./sync-fixture";

const fixture = createSyncFixture();
beforeAll(() => fixture.initialize());
afterAll(() => fixture.close());

// Clients upload a latest state after a fixed number of updates (PRD 0014 uses 1,000). The bound does
// not depend on the count, so this check runs ten small cycles within the default test allowance.
const updatesPerState = 10;
const cycles = 10;

test("document storage stays below twice its latest state after every compaction (R23)", async () => {
  const { sync } = fixture.open({ gracePeriodMs: 0 });
  const address = { projectId: randomId("project"), spaceOwner: null, documentId: randomId("doc") };
  const device = { accountId: randomId("account"), deviceId: randomId("device") };
  let stateId: string | null = null;
  for (let cycle = 1; cycle <= cycles; cycle++) {
    await Promise.all(
      Array.from({ length: updatesPerState }, () =>
        sync.documents.appendUpdate(address, device, {
          updateId: randomId("update"),
          payload: encode(crypto.getRandomValues(new Uint8Array(120))),
          blobIds: [],
        }),
      ),
    );
    // A real latest state grows slowly with the document; random bytes stand in for its ciphertext.
    const payload = crypto.getRandomValues(new Uint8Array(4 * 1024 + cycle));
    const replaced = await sync.documents.replaceState(address, device, {
      stateId: randomId("state"),
      baseStateId: stateId,
      through: cycle * updatesPerState,
      payload: encode(payload),
      summary: encode(new Uint8Array(16)),
      blobIds: [],
    });
    stateId = replaced.state.stateId;
    await sync.cleanup();
    const stored = await fixture.storedBytes();
    expect(stored).toBeGreaterThanOrEqual(payload.byteLength);
    expect(stored).toBeLessThan(2 * payload.byteLength);
  }
});
