// Successful recovery needs a qualified held-directory adapter. Windows and
// musl exercise the explicit unsupported contract in native-recovery.p0.test.ts.
// A broken adapter on macOS or glibc remains a failure of the supported contract.
const { header } = process.report.getReport() as { header: { glibcVersionRuntime?: string } };
export const nativeRecoverySupported =
  process.platform === "darwin" || (process.platform === "linux" && !!header.glibcVersionRuntime);
