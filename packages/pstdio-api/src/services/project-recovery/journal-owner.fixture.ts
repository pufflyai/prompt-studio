import { openRecoveryJournal } from "./journal";

const journal = await openRecoveryJournal({ root: process.argv[2]!, source: ["project", "account", "workspace"] });
const release = await journal.acquire();
if (!release) throw new Error("Source already owned");
process.once("SIGTERM", () => void release().then(() => process.exit(0)));
console.log("owned");
setInterval(() => {}, 1000);
