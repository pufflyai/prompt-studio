import { BUNDLE_RESULT_PREFIX, buildEntryHere } from "./bundle-entry";

/** The private bundler process: reads one job from stdin and reports its outcome on stdout. */
export const runBundleChild = async () => {
  try {
    await buildEntryHere(JSON.parse(await Bun.stdin.text()));
    process.stdout.write(`\n${BUNDLE_RESULT_PREFIX}${JSON.stringify({ ok: true })}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // The host keeps only the end of the output, so the result line stays well inside it.
    const reported = message.length > 16_384 ? `${message.slice(0, 16_384)}…` : message;
    process.stdout.write(`\n${BUNDLE_RESULT_PREFIX}${JSON.stringify({ error: reported })}\n`);
    process.exitCode = 1;
  }
};
