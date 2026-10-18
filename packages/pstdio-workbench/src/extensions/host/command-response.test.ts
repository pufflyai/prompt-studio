import { expect, test } from "bun:test";
import { unwrapCommandValue } from "./command-response";

test("throwing from a rejected command keeps the complete outcome", () => {
  const outcome = {
    ok: false,
    status: "rejected",
    code: "stale_revision",
    reason: "Changed",
    data: { revision: 2 },
    cause: { source: "storage" },
    notices: [{ type: "warning", message: "Reload" }],
  };
  let failure: unknown;
  try {
    unwrapCommandValue({ outcome });
  } catch (error) {
    failure = error;
  }
  expect(failure).toMatchObject({ outcome });
});
