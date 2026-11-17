/** Native layouts and no-replace calls are qualified only on macOS and glibc Linux.
 * A musl compatibility library can expose libc.so.6 without meeting that contract. */
export const supportsNativeRecovery = () => {
  if (process.platform === "darwin") return true;
  if (process.platform !== "linux") return false;
  const { header } = process.report.getReport() as { header: { glibcVersionRuntime?: string } };
  return !!header.glibcVersionRuntime;
};
