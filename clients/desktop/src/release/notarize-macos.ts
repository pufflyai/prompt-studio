import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { notarizationFailure, notaryCredentials, waitForNotarization } from "./notarization-status";
import type { DesktopSigningConfig } from "./release-config";
import { runMacCommand, runStapler } from "./stapler";

export const notarizeMacApp = async (
  appPath: string,
  credentials: NonNullable<DesktopSigningConfig["macosNotarization"]>,
  run = runMacCommand,
  wait = async (milliseconds: number) => {
    await new Promise((resolve) => setTimeout(resolve, milliseconds));
  },
) => {
  const temporary = mkdtempSync(join(tmpdir(), "pstdio-notary-"));
  try {
    const archive = join(temporary, `${basename(appPath)}.zip`);
    const zipped = await run("ditto", ["-c", "-k", "--sequesterRsrc", "--keepParent", appPath, archive]);
    if (zipped.code !== 0) throw new Error(`Could not archive signed app:\n${zipped.stdout}${zipped.stderr}`);
    console.log("Submitting signed macOS app for notarization");
    const submitted = await run("xcrun", [
      "notarytool",
      "submit",
      archive,
      ...notaryCredentials(credentials),
      "--output-format",
      "json",
    ]);
    const submissionFailure = `macOS notarization failed with code ${submitted.code}:\n${submitted.stdout}${submitted.stderr}`;
    let result: { id?: string; status?: string };
    try {
      result = JSON.parse(submitted.stdout);
    } catch {
      throw new Error(submissionFailure);
    }
    if (submitted.code !== 0 || !result.id || result.status === "Invalid")
      throw await notarizationFailure(result.id, submissionFailure, credentials, run);
    // Upload and waiting are separate so a failed status request cannot lose the
    // submission identity or cause the same signed app to be uploaded again.
    await waitForNotarization(result.id, credentials, run, wait);
    console.log(`macOS notarization accepted: ${result.id}`);
    await runStapler("staple", appPath, run);
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
};
