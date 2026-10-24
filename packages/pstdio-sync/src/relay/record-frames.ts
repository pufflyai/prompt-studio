import { type AssetReference, recordFrameHeaderSchema } from "pstdio-sync-contracts";

/**
 * One record's Yjs bytes. In an update frame they are that record's changes; in a latest-state
 * chunk they are its full state. A frame is applied whole, so a multi-record save stays one unit.
 */
export interface RecordFrame {
  records: { recordId: string; bytes: Uint8Array }[];
  assets: AssetReference[];
  blob?: { blobId: string; byteLength: number };
}

export const encodeRecordFrame = (frame: RecordFrame) => {
  const header = new TextEncoder().encode(
    JSON.stringify({
      version: 1,
      records: frame.records.map((record) => ({ recordId: record.recordId, byteLength: record.bytes.length })),
      assets: frame.assets,
      ...(frame.blob && { blob: frame.blob }),
    }),
  );
  const total = 4 + header.length + frame.records.reduce((sum, record) => sum + record.bytes.length, 0);
  const bytes = new Uint8Array(total);
  new DataView(bytes.buffer).setUint32(0, header.length);
  bytes.set(header, 4);
  let offset = 4 + header.length;
  for (const record of frame.records) {
    bytes.set(record.bytes, offset);
    offset += record.bytes.length;
  }
  return bytes;
};

export const decodeRecordFrame = (bytes: Uint8Array): RecordFrame => {
  if (bytes.length < 4) throw new Error("Record frame is truncated");
  const headerLength = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0);
  if (4 + headerLength > bytes.length) throw new Error("Record frame is truncated");
  const header = recordFrameHeaderSchema.parse(
    JSON.parse(new TextDecoder().decode(bytes.subarray(4, 4 + headerLength))),
  );
  let offset = 4 + headerLength;
  const records = header.records.map(({ recordId, byteLength }) => {
    const record = { recordId, bytes: bytes.slice(offset, offset + byteLength) };
    offset += byteLength;
    return record;
  });
  if (offset !== bytes.length) throw new Error("Record frame length does not match its header");
  return { records, assets: header.assets, ...(header.blob && { blob: header.blob }) };
};

/** Bytes a frame adds for one record, so callers can split work under the relay's size limits. */
export const recordFrameCost = (recordId: string, bytes: Uint8Array) => bytes.length + recordId.length + 48;
