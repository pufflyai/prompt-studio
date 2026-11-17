import type { ProjectReturnAction, ProjectSyncStatus } from "pstdio-api-contracts";
import type { Arguments, Argv } from "yargs";
import { apiClient } from "@/features/api-client";

type Deps = {
  status: (projectId: string) => Promise<ProjectSyncStatus>;
  resolve: (projectId: string, action: ProjectReturnAction) => Promise<unknown>;
  log: (message: string) => void;
};

const defaultDeps: Deps = {
  status: (projectId) => apiClient().account.projectSyncStatus(projectId),
  resolve: (projectId, action) => apiClient().account.resolveReturnedChanges(projectId, action),
  log: console.log,
};

const actions = ["apply", "discard", "dismiss"] as const;

export const command = "returned-changes <id> [action]";
export const describe =
  "Show changes this device made while away from Cloud. Apply or discard changes held for review, or dismiss the changes Cloud replaced.";
export const builder = (yargs: Argv) =>
  yargs.positional("id", { type: "string", demandOption: true, describe: "Project ID" }).positional("action", {
    choices: actions,
    describe:
      "apply uploads held changes; fields other devices changed keep their version. discard drops them and shows Cloud's copy. dismiss clears the replaced list.",
  });

const record = (entry: { label?: string; recordId: string; fields: string[]; deleted: boolean }) =>
  `  ${entry.label ?? entry.recordId}${entry.deleted ? " (deleted)" : ""}${entry.fields.length ? ` ${entry.fields.join(", ")}` : ""}`;

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async (args: Arguments<{ id: string; action?: ProjectReturnAction }>) => {
    if (args.action) {
      await deps.resolve(args.id, args.action);
      const done = { apply: "Held changes upload now.", discard: "Held changes were discarded.", dismiss: "Cleared." };
      deps.log(done[args.action]);
      return;
    }
    const { away, replaced } = await deps.status(args.id);
    if (!away && !replaced) {
      deps.log("No changes from time away.");
      return;
    }
    if (away) {
      deps.log(
        away.state === "held"
          ? `${away.total} changed records (${away.deletions} deleted) are held for review. Run \`pst projects returned-changes ${args.id} apply\` or \`discard\`.`
          : `${away.total} changed records (${away.deletions} deleted) upload when an account that syncs this project signs in.`,
      );
      for (const entry of away.records) deps.log(record(entry));
    }
    if (replaced) {
      deps.log(`${replaced.total} of this device's changes were replaced by another device's.`);
      for (const entry of replaced.records) deps.log(record(entry));
    }
  };

export const handler = createHandler();
