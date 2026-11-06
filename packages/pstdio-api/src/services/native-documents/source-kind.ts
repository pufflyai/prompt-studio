import type { NativeDocumentSource } from "pstdio-api-contracts";

export const isRecordFieldSource = (source: NativeDocumentSource | undefined) =>
  source?.kind === "record" || source?.kind === "collection";
