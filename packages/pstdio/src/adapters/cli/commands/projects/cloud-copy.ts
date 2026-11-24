import { LocalRemovalConflictError, type ProjectCopyDevice, PstdioApiError } from "@pstdio/sdk/client";
import type { Arguments, Argv } from "yargs";
import {
  downloadCloudProject,
  inspectLocalRemoval,
  listCloudProjects,
  readCloudCopyDevice,
  readCloudDeletion,
  removeLocalProject,
  startCloudDeletion,
} from "@/features/projects/api/project-cloud-copy";

type ProjectArgs = { "project-id": string };

const projectId = (yargs: Argv) =>
  yargs.positional("project-id", { type: "string", demandOption: true, describe: "The Cloud project ID" });

const defaults = {
  device: readCloudCopyDevice,
  catalog: listCloudProjects,
  inspect: inspectLocalRemoval,
  remove: removeLocalProject,
  download: downloadCloudProject,
  erase: startCloudDeletion,
  status: readCloudDeletion,
  output: (value: unknown) => console.log(JSON.stringify(value)),
  scope: (message: string) => console.error(message),
};

const discardMessage = "Upload completion is pending or unknown. Use --discard-unsynced to acknowledge the risk.";

const inspectRemoval = async (deps: typeof defaults, id: string, expectedDevice: ProjectCopyDevice, team?: string) => {
  try {
    return await deps.inspect(id, expectedDevice);
  } catch (error) {
    if (!(error instanceof PstdioApiError) || error.status !== 404) throw error;
    const { projects } = await deps.catalog(team, expectedDevice);
    if (!projects.some((entry) => entry.id === id && entry.presence === "cloud-only")) throw error;
    return null;
  }
};

export const createProjectCloudCommands = (deps = defaults) => ({
  remove: {
    command: "delete-local <project-id>",
    describe: "Remove this device's copy of a Cloud project",
    builder: (yargs: Argv) =>
      projectId(yargs)
        .option("team", { type: "string", describe: "Owning Cloud team account ID" })
        .option("discard-unsynced", {
          type: "boolean",
          default: false,
          describe: "Acknowledge possible loss of unsynced work on this device",
        }),
    handler: async (argv: Arguments<ProjectArgs & { "discard-unsynced"?: boolean; team?: string }>) => {
      const id = argv["project-id"];
      const discardUnsynced = argv["discard-unsynced"] === true;
      const expectedDevice = await deps.device();
      if (!expectedDevice) throw new Error("Sign in to Cloud, then run delete-local again.");
      const preflight = await inspectRemoval(deps, id, expectedDevice, argv.team);
      if (!preflight) {
        deps.output({ projectId: id, presence: "cloud-only" });
        return;
      }
      deps.scope(`Remove "${preflight.name}" (${id}) from this device. Cloud and other devices keep their copies.`);
      if (preflight.requiresDiscard && !discardUnsynced) throw new Error(discardMessage);
      try {
        const expectedAccount = preflight.account;
        deps.output(
          await deps.remove(id, { discardUnsynced, expectedDevice, ...(expectedAccount && { expectedAccount }) }),
        );
      } catch (error) {
        if (error instanceof LocalRemovalConflictError) throw new Error(discardMessage, { cause: error });
        throw error;
      }
    },
  },
  download: {
    command: "download <project-id>",
    describe: "Download a Cloud project to this device",
    builder: projectId,
    handler: async (argv: Arguments<ProjectArgs>) => {
      deps.output(await deps.download(argv["project-id"]));
    },
  },
  erase: {
    command: "delete-cloud <project-id>",
    describe: "Permanently delete a project from Cloud",
    builder: (yargs: Argv) =>
      projectId(yargs).option("team", { type: "string", describe: "Owning Cloud team account ID" }).option("confirm", {
        type: "boolean",
        default: false,
        describe: "Confirm permanent deletion of the Cloud project and its retained Cloud data",
      }),
    handler: async (argv: Arguments<ProjectArgs & { confirm?: boolean; team?: string }>) => {
      if (argv.confirm !== true) throw new Error("Use --confirm to authorize permanent Cloud deletion.");
      const id = argv["project-id"];
      const signIn = "Sign in to Cloud, then run delete-cloud again to confirm deletion for that account.";
      const expectedDevice = await deps.device();
      if (!expectedDevice) throw new Error(signIn);
      const { projects, deletions, account } = await deps.catalog(argv.team, expectedDevice);
      if (!account) throw new Error(signIn);
      const name =
        projects.find((entry) => entry.id === id)?.name ?? deletions.find((entry) => entry.projectId === id)?.name;
      const label = name && name !== id ? `"${name}" (${id})` : id;
      deps.scope(`Permanently delete ${label} from Cloud. Devices keep their downloaded copies as local projects.`);
      deps.output(await deps.erase(id, { confirm: true, expectedAccount: account, expectedDevice }));
    },
  },
  status: {
    command: "deletion-status <project-id>",
    describe: "Read a Cloud project's permanent deletion status",
    builder: projectId,
    handler: async (argv: Arguments<ProjectArgs>) => {
      deps.output(await deps.status(argv["project-id"]));
    },
  },
});

export const projectCloudCommands = Object.values(createProjectCloudCommands());
