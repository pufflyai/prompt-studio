import { writeVarUint } from "lib0/encoding";
import * as Y from "yjs";

export type FragmentStruct = Y.Item | Y.GC;
export type FragmentDeletes = Map<number, { clock: number; len: number }[]>;
export interface FragmentRange {
  client: number;
  clock: number;
  len: number;
}

const writeDeletes = (encoder: Y.UpdateEncoderV1, deletes: FragmentDeletes) => {
  writeVarUint(encoder.restEncoder, deletes.size);
  for (const [client, ranges] of [...deletes].sort(([a], [b]) => b - a)) {
    encoder.resetDsCurVal();
    writeVarUint(encoder.restEncoder, client);
    writeVarUint(encoder.restEncoder, ranges.length);
    for (const range of ranges) {
      encoder.writeDsClock(range.clock);
      encoder.writeDsLen(range.len);
    }
  }
};

/** Sparse persisted fragments use Skip; only a private working view may use GC coverage. */
export const encodeRecordFragment = (
  structs: FragmentStruct[],
  deletes: FragmentDeletes,
  clocks?: ReadonlyMap<number, number>,
) => {
  const clients = new Map<number, FragmentStruct[]>();
  for (const struct of structs) {
    const entries = clients.get(struct.id.client) ?? [];
    entries.push(struct);
    clients.set(struct.id.client, entries);
  }
  if (clocks) for (const [client, clock] of clocks) if (clock > 0 && !clients.has(client)) clients.set(client, []);
  const encoder = new Y.UpdateEncoderV1();
  const fillers: FragmentRange[] = [];
  writeVarUint(encoder.restEncoder, clients.size);
  for (const [client, original] of [...clients].sort(([a], [b]) => b - a)) {
    original.sort((a, b) => a.id.clock - b.id.clock);
    const output: (FragmentStruct | Y.Skip)[] = [];
    let clock = clocks ? 0 : original[0].id.clock;
    const start = clock;
    const gap = (end: number) => {
      if (end <= clock) return;
      const len = end - clock;
      output.push(clocks ? new Y.GC(Y.createID(client, clock), len) : new Y.Skip(Y.createID(client, clock), len));
      if (clocks) fillers.push({ client, clock, len });
      clock = end;
    };
    for (const struct of original) {
      gap(struct.id.clock);
      if (struct.id.clock < clock) throw new Error("Overlapping record fragment structures");
      output.push(struct);
      clock = struct.id.clock + struct.length;
    }
    gap(clocks?.get(client) ?? 0);
    writeVarUint(encoder.restEncoder, output.length);
    encoder.writeClient(client);
    writeVarUint(encoder.restEncoder, start);
    for (const struct of output) struct.write(encoder, 0);
  }
  writeDeletes(encoder, deletes);
  return { state: encoder.toUint8Array(), fillers };
};
