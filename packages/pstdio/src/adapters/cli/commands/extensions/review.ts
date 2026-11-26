import { type ExtensionUpgradeReviewRequest, extensionUpgradeReviewRequestSchema } from "pstdio-api-contracts";
import type { Arguments, Argv } from "yargs";
import { apiClient } from "@/features/api-client";
import { selectProjectExtensions } from "@/features/extensions/project-extension-selectors";
import { resolveProjectId } from "@/features/projects/resolve-project-id";

const actions = ["begin", "read", "file", "refresh", "save", "validate", "apply", "cancel"] as const;

export const command = "review <action> <name>";
export const describe = "Inspect, refresh, resolve, or explicitly apply an extension upgrade review";

type ReviewArgs = {
  action: (typeof actions)[number];
  name: string;
  "project-id"?: string;
  "review-id"?: string;
  path?: string;
  revision?: string;
  resolutions?: string;
  "use-published"?: boolean;
};

export const builder = (yargs: Argv) =>
  yargs
    .positional("action", { type: "string", choices: actions, describe: "Review operation" })
    .positional("name", { type: "string", describe: "Installed extension name or project instance ID" })
    .option("project-id", { type: "string", describe: "Project ID" })
    .option("review-id", { type: "string", describe: "ID returned by the begin operation" })
    .option("revision", { type: "string", describe: "Revision returned by the latest review response" })
    .option("path", { type: "string", describe: "Relative file path shown in the review" })
    .option("resolutions", { type: "string", describe: "JSON file containing per-path resolutions to stage or apply" })
    .option("use-published", {
      type: "boolean",
      describe: "Switch to the published provider and keep the local folder",
    });

const requestFor = async (argv: ReviewArgs): Promise<ExtensionUpgradeReviewRequest> => {
  const { action } = argv;
  if (action === "begin") return { action };
  const id = argv["review-id"];
  if (!id) throw new Error("Supply --review-id from the begin operation.");
  if (action === "file")
    return extensionUpgradeReviewRequestSchema.parse({ action, id, path: argv.path, revision: argv.revision });
  if (action === "refresh") {
    return extensionUpgradeReviewRequestSchema.parse({
      action,
      id,
      revision: argv.revision,
      resolutions: argv.resolutions ? await Bun.file(argv.resolutions).json() : undefined,
    });
  }
  if (action === "apply" || action === "save" || action === "validate") {
    if (!argv.revision) throw new Error("Supply --revision from the latest review response.");
    const resolutions = argv.resolutions ? await Bun.file(argv.resolutions).json() : [];
    return extensionUpgradeReviewRequestSchema.parse({
      action,
      id,
      resolutions,
      revision: argv.revision,
      ...(action === "apply" && { usePublished: argv["use-published"] }),
    });
  }
  return extensionUpgradeReviewRequestSchema.parse({ action, id });
};

export const handler = async (argv: Arguments<ReviewArgs>) => {
  const { projectId } = resolveProjectId(process.cwd(), argv["project-id"]);
  const { extensions } = await apiClient().extensions.listProject(projectId);
  const direct = extensions.find(({ id }) => id === argv.name);
  const matches = direct ? [direct] : selectProjectExtensions(extensions, argv.name);
  if (matches.length !== 1)
    throw new Error(`Select one installed extension by its install name or project instance ID: ${argv.name}.`);
  const request = await requestFor(argv);
  const result = await apiClient().extensions.reviewUpgrade(projectId, matches[0]!.id, request);
  console.log(JSON.stringify(result, null, 2));
};
