import type { Arguments, Argv } from "yargs";
import { updateHarness } from "@/features/harnesses/api/update-harness";

export const command = "update <harness-id>";
export const describe = "Update harness configuration";

export const builder = (yargs: Argv) =>
  yargs
    .positional("harness-id", {
      type: "string",
      demandOption: true,
      describe: "Harness provider id",
    })
    .option("default", { type: "boolean", describe: "Make this harness the default" })
    .option("binary", { type: "string", describe: "Override harness executable path" })
    .option("skills-dir", { type: "string", describe: "Override harness skills directory" });

type UpdateArgs = {
  "harness-id": string;
  default?: boolean;
  binary?: string;
  "skills-dir"?: string;
};

export const handler = async (argv: Arguments<UpdateArgs>) => {
  const config = await updateHarness(argv["harness-id"], {
    is_default: argv.default,
    binary: argv.binary,
    skills_dir: argv["skills-dir"],
  });
  const suffix = config.is_default ? " (default)" : "";
  console.log(`Harness "${config.harness_id}" updated${suffix}.`);
};
