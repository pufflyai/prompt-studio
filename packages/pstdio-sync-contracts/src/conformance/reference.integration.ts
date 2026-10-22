import { afterAll } from "bun:test";
import { createReferenceFixture } from "./reference";
import { registerConformance } from "./suite";

const fixture = await createReferenceFixture(
  process.env.SYNC_TEST_DATABASE_URL!,
  process.env.SYNC_TEST_OBJECT_ENDPOINT!,
);
afterAll(() => fixture.close());
registerConformance(() => fixture.scenario());

// Covered checkpoint contracts use independent tables and the same isolated services.
import "./coverage.integration";
import "./document-session.integration";
