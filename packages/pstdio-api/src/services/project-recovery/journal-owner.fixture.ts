import { acquireRecoveryJournalLease, openRecoveryJournal } from "./journal";

const journal = await openRecoveryJournal({ root: process.argv[2]!, source: ["project", "account", "workspace"] });
const release =
  process.argv[3] === "--lease-path" ? acquireRecoveryJournalLease(process.argv[2]!) : await journal.acquire();
if (!release) throw new Error("Source already owned");
process.once("SIGTERM", () => void Promise.resolve(release()).then(() => process.exit(0)));
console.log("owned");
setInterval(() => {}, 1000);
