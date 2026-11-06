import type { StateInfo } from "pstdio-sync-contracts";
import { openState, type SyncSpace } from "../encryption";
import type { DocumentRelay } from "../relay";
import { type OrderedIndexReference, readOrderedIndexReference } from "../relay";

export interface LogState {
  root: OrderedIndexReference | null;
  offset: number;
}
export const openLogState = async (
  space: SyncSpace,
  documentId: string,
  relay: DocumentRelay,
  state: StateInfo | null,
): Promise<LogState> => {
  if (!state) return { root: null, offset: 0 };
  const value = JSON.parse(
    new TextDecoder("utf-8", { fatal: true }).decode(
      await openState(space, documentId, state, await relay.state(state)),
    ),
  );
  if (
    !value ||
    Object.keys(value).length !== 4 ||
    value.version !== 1 ||
    value.format !== "append-log" ||
    !Number.isSafeInteger(value.offset) ||
    value.offset < 0
  )
    throw new Error("Invalid append-only log checkpoint");
  return { root: value.root === null ? null : readOrderedIndexReference(value.root), offset: value.offset };
};
