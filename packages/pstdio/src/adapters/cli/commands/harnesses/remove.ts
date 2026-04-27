import type { Arguments, Argv } from "yargs";
import { findGitRoot, readConfig } from "@/features/config/config";
import { removeHarness } from "@/features/harnesses/api/remove-harness";
import { toAgentId, toHarnessId } from "@/features/harnesses/harness-id";
import { removeBundledSkillsForAgent } from "@/features/skills/install-default-skills";

export const command = "remove <harness-id>";
export const describe = "Remove harness configuration";

export const builder = (yargs: Argv) =>
  yargs
    .positional("harness-id", {
      type: "string",
      demandOption: true,
      describe: "Harness provider id",
    })
    .option("delete-skills", {
      type: "boolean",
      default: false,
      describe: "Also delete the skills installed for this harness provider",
    });

type RemoveArgs = {
  "harness-id": string;
  "delete-skills": boolean;
};

export const handler = async (argv: Arguments<RemoveArgs>) => {
  const harnessId = toHarnessId(argv["harness-id"]);
  const agentId = toAgentId(harnessId);

  await removeHarness(harnessId);

  if (argv["delete-skills"]) {
    const root = findGitRoot(process.cwd());
    const projectConfig = root ? readConfig(root) : null;

    if (root && projectConfig) {
      const removed = await removeBundledSkillsForAgent(root, agentId, projectConfig.project_id);
      if (removed.length > 0) {
        console.log(`Deleted ${removed.length} skill(s): ${removed.join(", ")}`);
      }
    }
  }

  console.log(`Harness "${harnessId}" removed.`);
};
