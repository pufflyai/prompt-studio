import type { ProjectExtensionInstance } from "@pstdio/sdk/api";
import { createRequest } from "@pstdio/sdk/client";
import type { Arguments, Argv } from "yargs";
import { apiClient } from "@/features/api-client";
import { resolveApiUrl } from "@/features/api-url";
import { resolveProjectId } from "@/features/projects/resolve-project-id";

export const command = "publication <action> [name]";
export const describe = "List, publish, adopt, roll back, or switch shared extension revisions";
export const builder = (yargs: Argv) =>
  yargs
    .positional("action", {
      choices: ["list", "publish", "adopt", "rollback", "enable", "disable"] as const,
      demandOption: true,
    })
    .positional("name", { type: "string", describe: "Installed extension name or published extension ID" })
    .option("project-id", { type: "string", describe: "Workbench project ID" })
    .option("revision", { type: "string", describe: "Previously published package SHA-256 for rollback" })
    .option("expected-revision", {
      type: "string",
      describe: "Observed catalog revision; defaults to the revision just read",
    });
interface Args {
  action: "list" | "publish" | "adopt" | "rollback" | "enable" | "disable";
  name?: string;
  "project-id"?: string;
  "expected-revision"?: string;
  revision?: string;
}

// Older disabled copies can share an extension ID. The enabled copy is the code this device runs.
export const findPublicationSource = (extensions: ProjectExtensionInstance[], name: string) => {
  const matches = extensions.filter((extension) => extension.installName === name || extension.extensionId === name);
  return matches.find((extension) => extension.enabled) ?? matches[0];
};

export const handler = async (argv: Arguments<Args>) => {
  const { projectId } = resolveProjectId(process.cwd(), argv["project-id"]);
  const request = createRequest({ baseUrl: resolveApiUrl(), token: process.env.PSTDIO_API_TOKEN });
  const path = `/v1/projects/${encodeURIComponent(projectId)}/extension-publications`;
  const records = await request<{ recordId: string; revision: string }[]>(path);
  if (argv.action === "list") {
    console.log(JSON.stringify(records, null, 2));
    return;
  }
  if (!argv.name) throw new Error("Choose an extension name or published extension ID.");
  const { extensions } = await apiClient().extensions.listProject(projectId);
  const source = findPublicationSource(extensions, argv.name);
  const extensionId = source?.extensionId ?? argv.name;
  const record = records.find((record) => record.recordId === extensionId);
  if (!record) throw new Error("Extension is not installed or published in this workbench.");
  const expectedRevision = argv["expected-revision"] ?? record.revision;
  let body: unknown;
  switch (argv.action) {
    case "publish":
      if (!source) throw new Error("Install the extension before publishing it.");
      body = { kind: "publish", instanceId: source.id, expectedRevision };
      break;
    case "adopt":
      body = { kind: "adopt", extensionId };
      break;
    case "rollback":
      if (!argv.revision) throw new Error("Choose a previously published package with --revision.");
      body = { kind: "rollback", extensionId, revision: argv.revision, expectedRevision };
      break;
    case "enable":
    case "disable":
      body = { kind: "enabled", extensionId, enabled: argv.action === "enable", expectedRevision };
      break;
  }
  console.log(JSON.stringify(await request(path, { method: "POST", body }), null, 2));
};
