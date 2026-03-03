import type { Arguments, Argv } from "yargs";
import { API_URL } from "@/features/api-url";
import { deleteProject } from "@/features/projects/api/delete-project";

export const command = "delete <project-id>";
export const describe = "Delete a project";

export const builder = (yargs: Argv) =>
  yargs.positional("project-id", {
    type: "string",
    demandOption: true,
    describe: "The project ID to delete",
  });

export const handler = async (argv: Arguments<{ "project-id": string }>) => {
  const projectId = argv["project-id"];

  await deleteProject(API_URL, projectId);
  console.log(`Project "${projectId}" deleted.`);
};
