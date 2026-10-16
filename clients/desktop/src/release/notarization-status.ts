import type { DesktopSigningConfig } from "./release-config";
import type { runMacCommand } from "./stapler";

export const notaryCredentials = (credentials: NonNullable<DesktopSigningConfig["macosNotarization"]>) => [
  "--key",
  credentials.appleApiKey,
  "--key-id",
  credentials.appleApiKeyId,
  "--issuer",
  credentials.appleApiIssuer,
];

export const notarizationFailure = async (
  submissionId: string | undefined,
  message: string,
  credentials: NonNullable<DesktopSigningConfig["macosNotarization"]>,
  run: typeof runMacCommand,
) => {
  if (!submissionId) return new Error(message);
  const diagnostics = await run("xcrun", ["notarytool", "log", submissionId, ...notaryCredentials(credentials)]).catch(
    () => ({ stdout: "", stderr: "" }),
  );
  return new Error(`${message}\n${diagnostics.stdout}${diagnostics.stderr}`);
};

export const waitForNotarization = async (
  submissionId: string,
  credentials: NonNullable<DesktopSigningConfig["macosNotarization"]>,
  run: typeof runMacCommand,
  wait: (milliseconds: number) => Promise<void>,
) => {
  const attempts = 3;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    console.log(`Waiting for macOS notarization ${submissionId}: attempt ${attempt}/${attempts}`);
    const result = await run("xcrun", [
      "notarytool",
      "wait",
      submissionId,
      ...notaryCredentials(credentials),
      "--output-format",
      "json",
    ]);
    let status: string | undefined;
    try {
      status = (JSON.parse(result.stdout) as { status?: string }).status;
    } catch {}
    if (result.code === 0 && status === "Accepted") return;
    const message = `macOS notarization ${submissionId} failed with code ${result.code}:\n${result.stdout}${result.stderr}`;
    if (status !== "Invalid" && result.code !== 0 && (result.stdout + result.stderr).includes("NSURLErrorDomain")) {
      if (attempt === attempts) throw new Error(message);
      await wait(1000 * 2 ** (attempt - 1));
    } else {
      throw await notarizationFailure(submissionId, message, credentials, run);
    }
  }
};
