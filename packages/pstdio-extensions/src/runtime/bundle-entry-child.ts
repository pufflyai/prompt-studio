import { buildEntryHere } from "./bundle-entry";
import { BUNDLE_START, type BundleOutcome } from "./preparation-bundle-command";

/** The private bundler process: reads one job from stdin and reports its outcome to the host. */
export const runBundleChild = async () => {
  const send = process.send?.bind(process);
  if (!send) throw new Error("The extension bundler requires its preparation host.");
  // Keep the IPC channel referenced until the host stops this whole process tree.
  process.on("disconnect", () => process.exit(1));
  if (process.platform === "win32") {
    // The host must own the Windows job before macros can start child processes.
    await new Promise<void>((ready) => {
      process.on("message", (message) => {
        if (message === BUNDLE_START) ready();
      });
    });
  } else {
    process.on("message", () => {});
  }
  let outcome: BundleOutcome;
  try {
    await buildEntryHere(JSON.parse(await Bun.stdin.text()));
    outcome = { kind: "bundle-result", ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Cap the diagnostic before sending it across the private channel.
    const reported = message.length > 16_384 ? `${message.slice(0, 16_384)}…` : message;
    outcome = { kind: "bundle-result", ok: false, error: reported };
  }
  send(outcome);
};
