import { resolve } from "node:path";
import { writePagedCollectionFixtures } from "./paged-collection-fixtures";

const root = resolve(import.meta.dir, "../../../..");
const fixtures = await writePagedCollectionFixtures(resolve(root, "__test-tmp__/paged-collection-extensions"));
await Bun.write(resolve(root, "__test-tmp__/paged-collection-defaults.json"), JSON.stringify(fixtures));
console.log(`Prepared ${fixtures.length} public fixture extensions`);
