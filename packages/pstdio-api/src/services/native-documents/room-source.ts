import type { NativeTextTarget } from "pstdio-api-contracts";
import { NativeDocumentRoomError } from "pstdio-db";
import { NativeSourceRecoveryError, type StorageOwner } from "pstdio-sync";
import type { ExtensionsRouteDeps } from "../../features/extensions/deps";
import { type loadNativeMarkdownFile, NativeDocumentSourceError } from "./file-source";
import { validateReplaySource } from "./replay-source";
import type { resolveNativeTextAccess } from "./source-access";
import { checkpointInitialState } from "./text-checkpoint";
import { validateNativeSourceAuthority } from "./validate-writable-source";

type Loaded = Awaited<ReturnType<typeof loadNativeMarkdownFile>>;
type Access = Awaited<ReturnType<typeof resolveNativeTextAccess>>;
type RoomSource = Pick<Access, "owner" | "documentKey" | "lifetime" | "content" | "projectionTarget">;
export type NativeRoomOpenInput = NativeTextTarget & {
  projectId: string;
  signal?: AbortSignal;
  sourceState?: Uint8Array;
  pendingUpdate?: Uint8Array;
  expectedSource?: { owner: StorageOwner; documentKey: string };
  validateLoaded?: (loaded: RoomSource) => void;
  access?: "read" | "write";
};
interface SourceDeps {
  load: (input: Parameters<typeof loadNativeMarkdownFile>[1]) => ReturnType<typeof loadNativeMarkdownFile>;
  initialize: (loaded: Loaded) => Promise<void>;
  access: (input: Parameters<typeof resolveNativeTextAccess>[1]) => Promise<Access>;
  storage: ExtensionsRouteDeps["extensionStorageService"];
}
export const loadNativeRoomSource = async (deps: Pick<SourceDeps, "load">, input: NativeRoomOpenInput) => {
  const loaded = await deps.load(input);
  if (input.expectedSource) validateNativeSourceAuthority(loaded, input.expectedSource);
  input.validateLoaded?.(loaded);
  return loaded;
};
const validateRoomSource = (input: NativeRoomOpenInput, loaded: RoomSource) => {
  if (input.expectedSource) validateNativeSourceAuthority(loaded, input.expectedSource);
  input.validateLoaded?.(loaded);
  const editable = loaded.content.editable !== false && input.access !== "read";
  if (input.pendingUpdate && !input.sourceState)
    throw new NativeDocumentRoomError("invalid_frame", "Pending editor frames need their original history");
  if (input.access !== undefined && input.sourceState && !editable)
    throw new NativeDocumentSourceError(403, "source_read_only", "A read-only session cannot supply recovery history");
  validateReplaySource(input.sourceState, loaded.documentKey, loaded.lifetime);
  if (input.pendingUpdate && !editable)
    throw new NativeDocumentSourceError(403, "source_read_only", "The text source is read only");
  return editable;
};
export const initializeNativeRoomSource = async (deps: SourceDeps, input: NativeRoomOpenInput) => {
  const loaded = await deps.load(input);
  const editable = validateRoomSource(input, loaded);
  await deps.initialize(loaded);
  return { loaded, editable, initial: loaded };
};

/** A registered authority joins canonical history without observing an in-flight physical save. */
export const joinNativeRoomSource = async (deps: SourceDeps, input: NativeRoomOpenInput) => {
  if (!input.expectedSource || !(await deps.storage.nativeFileProjections.read(input.expectedSource))) return;
  const loaded = await deps.access(input);
  const editable = validateRoomSource(input, loaded);
  const text = deps.storage.openNativeTextDocument({ owner: loaded.owner, fileId: loaded.documentKey });
  const { state } = await text.snapshot();
  try {
    await checkpointInitialState(state);
  } catch {
    throw new NativeSourceRecoveryError("The registered text authority needs its valid canonical history");
  }
  return { loaded, editable, initial: undefined };
};
