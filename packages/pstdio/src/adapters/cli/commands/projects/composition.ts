import type { Arguments, Argv } from "yargs";
import { apiClient } from "@/features/api-client";
import { resolveProjectId } from "@/features/projects/resolve-project-id";

export const command = "composition";
export const describe = "Read or replace the project's default page and resource openers";
export const builder = (yargs: Argv) =>
  yargs
    .option("project-id", { type: "string", describe: "Project ID" })
    .option("value", { type: "string", describe: "Replacement composition as JSON; omit to read" });

export const handler = async (argv: Arguments<{ "project-id"?: string; value?: string }>) => {
  const { projectId } = resolveProjectId(process.cwd(), argv["project-id"]);
  const client = apiClient().projects;
  const result =
    argv.value === undefined
      ? await client.composition(projectId)
      : await client.setComposition(projectId, JSON.parse(argv.value));
  console.log(JSON.stringify(result, null, 2));
};
