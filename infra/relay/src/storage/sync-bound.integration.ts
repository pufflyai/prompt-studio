import { afterAll, beforeAll, expect, test } from "bun:test";
import { createSyncFixture, encode, randomId } from "./sync-fixture";

const fixture = createSyncFixture();
beforeAll(() => fixture.initialize());
afterAll(() => fixture.close());

// Clients upload a latest state after a fixed number of updates (PRD 0014 uses 1,000). The bound does
// not depend on the count, so this check runs ten small cycles within the default test allowance.
const updatesPerState = 10;
const cycles = 10;
const updateBytes = 120;

test("document storage stays below twice its latest state plus the grace-period copy (R23)", async () => {
  // The default seven-day grace period: nothing expires during the test.
  const { sync } = fixture.open();
  const address = { projectKey: randomId("project"), spaceOwner: null, documentId: randomId("doc") };
  const device = { accountId: randomId("account"), deviceId: randomId("device") };
  let previous = { stateId: null as string | null, bytes: 0 };
  for (let cycle = 1; cycle <= cycles; cycle++) {
    await Promise.all(
      Array.from({ length: updatesPerState }, () =>
        sync.documents.appendUpdate(address, device, {
          updateId: randomId("update"),
          payload: encode(crypto.getRandomValues(new Uint8Array(updateBytes))),
          blobIds: [],
        }),
      ),
    );
    // A real latest state grows slowly with the document; random bytes stand in for its ciphertext.
    const payload = crypto.getRandomValues(new Uint8Array(4 * 1024 + cycle));
    const replaced = await sync.documents.replaceState(address, device, {
      stateId: randomId("state"),
      baseStateId: previous.stateId,
      through: cycle * updatesPerState,
      payload: encode(payload),
      summary: encode(new Uint8Array(16)),
      blobIds: [],
    });
    // Cleanup removes the bytes of rows the new state made unnecessary.
    await sync.cleanup();
    // The grace-period copy is the replaced state and the updates after it: together they rebuild the
    // document if the new state turns out broken (R20).
    const graceCopy = previous.bytes + updatesPerState * updateBytes;
    const stored = await fixture.storedBytes();
    expect(stored).toBeGreaterThanOrEqual(payload.byteLength + graceCopy);
    expect(stored - graceCopy).toBeLessThan(2 * payload.byteLength);
    previous = { stateId: replaced.state.stateId, bytes: payload.byteLength };
  }
});
