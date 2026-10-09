import type { UpdateQueuedFollowUpInput } from "@pstdio/sdk/api";
import type { Arguments, Argv } from "yargs";
import { apiClient } from "@/features/api-client";

export const command = "queue";
export const describe = "Read saved queued requests, revisions, and active-run preconditions";
export const builder = (yargs: Argv) =>
  yargs.option("id", { type: "string", demandOption: true, describe: "Session ID" });
export const handler = async (argv: Arguments<{ id: string }>) =>
  console.log(JSON.stringify(await apiClient().sessions.getQueuedFollowUps(argv.id), null, 2));

export const updateQueuedCommand = {
  command: "update-queued",
  describe: "Update a complete saved request without sending it",
  builder: (yargs: Argv) =>
    builder(yargs)
      .option("queue-position", { type: "number", demandOption: true, describe: "Saved queue position" })
      .option("expected-revision", { type: "string", demandOption: true, describe: "Revision from sessions queue" })
      .option("prompt", { type: "string", demandOption: true, describe: "Updated prompt" })
      .option("model", { type: "string", describe: "Model ID, or an empty string for the provider default" })
      .option("params", { type: "string", describe: "JSON object of complete harness params, or null to reset" })
      .option("attachments", { type: "string", describe: "JSON array of file_id references; [] clears attachments" }),
  handler: async (
    argv: Arguments<{
      id: string;
      "queue-position": number;
      "expected-revision": string;
      prompt: string;
      model?: string;
      params?: string;
      attachments?: string;
    }>,
  ) => {
    const input: UpdateQueuedFollowUpInput = { prompt: argv.prompt, expectedRevision: argv["expected-revision"] };
    if (argv.model !== undefined) input.model = argv.model || null;
    if (argv.params !== undefined) input.params = JSON.parse(argv.params);
    if (argv.attachments !== undefined) input.attachments = JSON.parse(argv.attachments);
    console.log(
      JSON.stringify(await apiClient().sessions.updateQueuedFollowUp(argv.id, argv["queue-position"], input), null, 2),
    );
  },
};

export const combineQueuedCommand = {
  command: "combine-queued",
  describe: "Combine compatible saved requests in their current queue order",
  builder: (yargs: Argv) =>
    builder(yargs)
      .option("target-position", { type: "number", demandOption: true, describe: "Destination queue position" })
      .option("source-position", { type: "number", demandOption: true, describe: "Source queue position" })
      .option("target-revision", {
        type: "string",
        demandOption: true,
        describe: "Destination revision from sessions queue",
      })
      .option("source-revision", {
        type: "string",
        demandOption: true,
        describe: "Source revision from sessions queue",
      }),
  handler: async (
    argv: Arguments<{
      id: string;
      "target-position": number;
      "source-position": number;
      "target-revision": string;
      "source-revision": string;
    }>,
  ) =>
    console.log(
      JSON.stringify(
        await apiClient().sessions.combineQueuedFollowUps(argv.id, argv["target-position"], {
          sourcePosition: argv["source-position"],
          sourceRevision: argv["source-revision"],
          targetRevision: argv["target-revision"],
        }),
        null,
        2,
      ),
    ),
};
