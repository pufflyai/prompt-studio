import { join } from "node:path";
import { runMacCommand, runStapler } from "./stapler";

const developerIdRequirement = (identifier: string) =>
  `=identifier "${identifier}" and anchor apple generic ` +
  "and certificate 1[field.1.2.840.113635.100.6.2.6] exists " +
  "and certificate leaf[field.1.2.840.113635.100.6.1.13] exists " +
  'and certificate leaf[subject.OU] = "XDNDHQS38D"';

export const verifyMacOSAppTrust = async (appPath: string, run = runMacCommand) => {
  const verify = async (label: string, command: string, args: string[]) => {
    const result = await run(command, args);
    if (result.code !== 0) {
      throw new Error(`macOS ${label} trust verification failed:\n${result.stdout}${result.stderr}`);
    }
  };
  await verify("application", "codesign", [
    "--verify",
    "--deep",
    "--strict",
    "--verbose=2",
    "--test-requirement",
    developerIdRequirement("studio.prompt.desktop"),
    appPath,
  ]);
  await verify("runtime", "codesign", [
    "--verify",
    "--strict",
    "--verbose=2",
    "--test-requirement",
    developerIdRequirement("studio.prompt.desktop.runtime"),
    join(appPath, "Contents", "Resources", "bin", "pstdio"),
  ]);
  await runStapler("validate", appPath, run);
  await verify("Gatekeeper", "spctl", ["--assess", "--type", "execute", "--verbose=2", appPath]);
};
