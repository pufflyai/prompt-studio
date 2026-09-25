import type { Argv } from "yargs";

export const command = "install-browser";
export const describe = "Install Chromium for extension smoke tests using the bundled runtime";

export const builder = (yargs: Argv) =>
  yargs.option("with-deps", {
    type: "boolean",
    default: false,
    describe: "Also install browser system dependencies; may require administrator access",
  });

export const handler = async (argv: { withDeps: boolean }) => {
  const { installSmokeBrowser } = await import("@/features/extensions/install-smoke-browser");
  process.exitCode = await installSmokeBrowser(argv);
};
