import type { Arguments, Argv } from "yargs";
import { apiClient } from "@/features/api-client";

export const command = "steer";
export const describe = "Send a saved queued request to the selected active run";
export const builder = (yargs: Argv) =>
  yargs
    .option("id", { type: "string", demandOption: true, describe: "Session ID" })
    .option("queue-position", { type: "number", demandOption: true, describe: "Saved queue position" })
    .option("expected-revision", { type: "string", demandOption: true, describe: "Revision from sessions queue" })
    .option("expected-run-started-at", {
      type: "string",
      demandOption: true,
      describe: "Active run identity from sessions queue",
    });
export const handler = async (
  argv: Arguments<{
    id: string;
    "queue-position": number;
    "expected-revision": string;
    "expected-run-started-at": string;
  }>,
) => {
  const result = await apiClient().sessions.steerQueuedFollowUp(argv.id, argv["queue-position"], {
    expectedRevision: argv["expected-revision"],
    expectedRunStartedAt: argv["expected-run-started-at"],
  });
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== "accepted") process.exitCode = 1;
};
