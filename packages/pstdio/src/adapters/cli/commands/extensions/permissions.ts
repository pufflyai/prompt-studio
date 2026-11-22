import { createClient } from "@pstdio/sdk/client";
import type { Arguments, Argv } from "yargs";
import { resolveApiUrl } from "@/features/api-url";
import { resolveProjectId } from "@/features/projects/resolve-project-id";

type PermissionsClient = ReturnType<typeof createClient>["extensions"]["processEnvironment"];

export const command = "permissions <action> <extension>";
export const describe = "Show, allow or revoke the host environment names an extension may pass to its children";
export const builder = (yargs: Argv) =>
  yargs
    .positional("action", { choices: ["show", "grant", "revoke"] as const, demandOption: true })
    .positional("extension", { type: "string", demandOption: true, describe: "Extension ID, such as acme.agent" })
    .option("project-id", { type: "string", describe: "Project ID" })
    .option("names", { type: "string", describe: "Comma-separated requested names to allow (grant)" })
    .option("source-identity", {
      type: "string",
      describe: "Source identity printed by `show`. A grant for changed source is refused (grant)",
    });

interface Args {
  action: "show" | "grant" | "revoke";
  extension: string;
  "project-id"?: string;
  names?: string;
  "source-identity"?: string;
}

const run = async (client: PermissionsClient, argv: Arguments<Args>) => {
  const { projectId } = resolveProjectId(process.cwd(), argv["project-id"]);
  if (argv.action === "show") return client.get(projectId, argv.extension);
  if (argv.action === "revoke") {
    await client.revoke(projectId, argv.extension);
    return client.get(projectId, argv.extension);
  }
  const names = (argv.names ?? "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
  if (!names.length) throw new Error("Choose the names to allow with --names.");
  const sourceIdentity = argv["source-identity"];
  if (!sourceIdentity) throw new Error("Pass the sourceIdentity printed by `show` as --source-identity.");
  return client.grant(projectId, argv.extension, { names, sourceIdentity });
};

export const createHandler = (client?: PermissionsClient) =>
  async function extensionPermissions(argv: Arguments<Args>) {
    const permissions = client ?? createClient({ baseUrl: resolveApiUrl() }).extensions.processEnvironment;
    console.log(JSON.stringify(await run(permissions, argv), null, 2));
  };

export const handler = createHandler();
