import { afterAll } from "bun:test";
import { registerConformance } from "pstdio-sync-contracts/conformance";
import { createGroupedConformanceFixture } from "./grouped-conformance-fixture";
import { createProductionRelayServices } from "./production-relay.fixture";

const fixture = await createGroupedConformanceFixture(
  await createProductionRelayServices(process.env.SYNC_TEST_DATABASE_URL!, process.env.SYNC_TEST_OBJECT_ENDPOINT!),
);
afterAll(() => fixture.close());
registerConformance(() => fixture.scenario());
