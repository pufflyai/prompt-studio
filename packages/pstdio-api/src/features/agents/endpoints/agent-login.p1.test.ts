import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestApp } from "../../../test-utils/create-test-app";
import {
  createTestHarnessRecord,
  createTestHarnessRegistry,
  testHarnessId,
} from "../../harnesses/test-harness-registry";

const providers = [
  {
    id: "native",
    label: "Native",
    status: "signed_out" as const,
    canLogout: true,
    methods: [{ id: "oauth", label: "Browser", kind: "oauth" as const }],
  },
];
let signedIn = false;
let handle: Awaited<ReturnType<typeof createTestApp>>;
let tempRoot: string;

beforeAll(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "agent-login-"));
  handle = await createTestApp({
    databasePath: ":memory:",
    storageRoot: join(tempRoot, "storage"),
    harnessRegistry: createTestHarnessRegistry([
      createTestHarnessRecord("sign-in", {
        provider: {
          detect: () => ({ available: true }),
          getAuthentication: (_ctx, input) => ({
            status: signedIn ? "signed_in" : "signed_out",
            provider: input?.model?.split("/")[0],
            providers,
          }),
        },
      }),
    ]),
  });
});

afterAll(async () => {
  await handle?.close();
  rmSync(tempRoot, { recursive: true, force: true });
});

test("account state is scoped to the selected model and refreshed after a change", async () => {
  const url = "/v1/agents/" + testHarnessId("sign-in") + "/authentication?model=native/model";
  const response = await handle.app.request(url);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ status: "signed_out", provider: "native", providers });
  signedIn = true;
  expect(await (await handle.app.request(url)).json()).toMatchObject({ status: "signed_in" });
});
