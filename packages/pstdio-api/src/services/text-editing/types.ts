import type { NativeTextTarget, TextEditingConnectionInput } from "pstdio-api-contracts";
import type { TextEditingEvent, TextWireSnapshot } from "pstdio-api-contracts/extension-kernel";
import type { ExtensionsRouteDeps } from "../../features/extensions/deps";
import type { createNativeDocumentService } from "../native-documents/documents";
import type { loadNativeMarkdownFile } from "../native-documents/file-source";
export interface TextEditingDeps {
  documents: ReturnType<typeof createNativeDocumentService>;
  load: (input: Parameters<typeof loadNativeMarkdownFile>[1]) => ReturnType<typeof loadNativeMarkdownFile>;
  access: (
    input: Parameters<typeof import("../native-documents/source-access").resolveNativeTextAccess>[1],
  ) => ReturnType<typeof import("../native-documents/source-access").resolveNativeTextAccess>;
  catalog: ExtensionsRouteDeps["extensionRuntimeCatalog"];
}
export interface TextGrant {
  token: string;
  target: NativeTextTarget;
  documentKey: string;
  ownerId: string;
  editable: boolean;
}
export interface TextMember {
  id: string;
  handle: string;
  grant?: TextGrant;
  room?: Awaited<ReturnType<TextEditingDeps["documents"]["open"]>>;
  queue: Promise<unknown>;
  sequence: number;
  lastFrame?: string;
  lastAck?: TextWireSnapshot;
  version: number;
  ready?: string;
  replay?: { identity: string; result: { handle: string; grant: { token: string }; snapshot: TextWireSnapshot } };
  stop?: () => void;
  refresh?: () => void;
  updatePresence?: () => Promise<void>;
  selection: { anchor: string; head: string } | null;
}
export interface TextConnection {
  projectId: string;
  token: string;
  input: TextEditingConnectionInput;
  extensionId?: string;
  grants: Map<string, TextGrant>;
  selected?: string;
  members: Map<string, TextMember>;
  pending: Set<Promise<unknown>>;
  active: boolean;
  disposed: boolean;
  listeners: Set<(event: TextEditingEvent) => void>;
  buffered: Map<string, TextEditingEvent>;
  barrier?: {
    id: string;
    waiting: Set<TextMember>;
    work: Promise<void>;
    resolve: () => void;
    reject: (error: unknown) => void;
  };
}
export interface TextConnectionAddress {
  projectId: string;
  token: string;
}
