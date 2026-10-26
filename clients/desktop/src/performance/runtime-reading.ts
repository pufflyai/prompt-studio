import { performanceRuntimeReadingSchema } from "pstdio-api-contracts/performance-diagnostics";

/** Only numeric, named metrics leave the runtime response. Bound bytes before parsing. */
export const readRuntimeDiagnostics = async (response: Response) => {
  const reader = response.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 16 * 1024) return null;
      chunks.push(value);
    }
    const value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    const result = performanceRuntimeReadingSchema.safeParse(value);
    return result.success ? result.data : null;
  } catch {
    return null;
  } finally {
    await reader.cancel();
  }
};
