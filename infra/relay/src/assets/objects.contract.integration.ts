import { afterAll, beforeAll, expect, test } from "bun:test";
import { createAssetFixture } from "./integration-fixture";
import { checkObjectStorage } from "./objects.contract";

const fixture = process.env.SYNC_TEST_OBJECT_ENDPOINT ? createAssetFixture() : null;
const required = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`Storage contract requires ${name}`);
  return value;
};
const config = fixture?.config ?? {
  bucket: required("RELAY_CONTRACT_BUCKET"),
  s3: {
    endpoint: required("RELAY_CONTRACT_ENDPOINT"),
    region: required("RELAY_CONTRACT_REGION"),
    forcePathStyle: true,
    credentials: {
      accessKeyId: required("RELAY_CONTRACT_ACCESS_KEY_ID"),
      secretAccessKey: required("RELAY_CONTRACT_SECRET_ACCESS_KEY"),
    },
  },
};
beforeAll(async () => fixture?.initialize());
afterAll(() => fixture?.close());
test("the configured provider supports the relay object operations", async () => {
  const result = await checkObjectStorage(config);
  expect(Object.values(result).every(Boolean)).toBe(true);
  console.log(JSON.stringify({ storageContract: result }));
});
