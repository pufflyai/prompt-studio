import type { Mutation } from "pstdio-sync-contracts";
import { createRelayStorage } from "./storage";

const mutation: Mutation = JSON.parse(process.env.RELAY_TEST_MUTATION!);
const storage = createRelayStorage(process.env.SYNC_TEST_DATABASE_URL!, { complete: async () => true });
const receipt = await storage.owner(mutation.scope).submit(mutation);
console.log(JSON.stringify(receipt));
// The parent kills this process after observing the committed result.
setInterval(() => {}, 1000);
