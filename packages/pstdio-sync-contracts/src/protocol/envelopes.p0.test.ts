import { expect, test } from "bun:test";
import { liveClientMessageSchema, stateEnvelopeSchema, updateEnvelopeSchema } from "./envelopes";

const update = { updateId: "update_0123456789abcdef", payload: "AAEC", blobIds: [] };

test("an update carries only its identity, encrypted bytes and blob identities", () => {
  expect(updateEnvelopeSchema.safeParse(update).success).toBe(true);
  expect(updateEnvelopeSchema.safeParse({ ...update, title: "Release plan" }).success).toBe(false);
  expect(updateEnvelopeSchema.safeParse({ ...update, payload: "not base64!" }).success).toBe(false);
});

test("a latest state names the state it replaces and the last update it includes", () => {
  const state = {
    stateId: "state_0123456789abcdef",
    baseStateId: null,
    through: 4,
    payload: "AAEC",
    summary: "AQ==",
    blobIds: ["blob_0123456789abcdef"],
  };
  expect(stateEnvelopeSchema.safeParse(state).success).toBe(true);
  expect(stateEnvelopeSchema.safeParse({ ...state, through: -1 }).success).toBe(false);
  expect(
    stateEnvelopeSchema.safeParse({ ...state, blobIds: ["blob_0123456789abcdef", "blob_0123456789abcdef"] }).success,
  ).toBe(false);
});

test("a live message has no fields besides its space and encrypted bytes", () => {
  expect(liveClientMessageSchema.safeParse({ type: "live", spaceOwner: null, payload: "AA==" }).success).toBe(true);
  expect(
    liveClientMessageSchema.safeParse({ type: "live", spaceOwner: null, payload: "AA==", cursor: 3 }).success,
  ).toBe(false);
});
