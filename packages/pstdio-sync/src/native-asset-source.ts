import { type Asset, canonicalJson } from "pstdio-sync-contracts";
import * as Y from "yjs";
import { decodeBytes } from "./encoding";
import { NativeSourceRecoveryError } from "./native-source-recovery";
import { initialTextDocumentState, readTextDocumentSeed } from "./text-document-seed";
import { assertCompatibleTextImports } from "./text-source-import";

export type NativeAssetSource = { asset: Asset; baseline: string; lifetime: string };
export const nativeAssetBindingBaseline = async (document: Y.Doc, content: string) => {
  if (document.getText("content").toString() === content) return Y.encodeStateAsUpdate(document);
  const seed = await readTextDocumentSeed(document);
  if (seed.source === content) return initialTextDocumentState(document);
  throw new NativeSourceRecoveryError("This file has no known bootstrap history. Its bytes were retained.");
};
const assetDocument = async (source: NativeAssetSource) => {
  const document = new Y.Doc();
  try {
    Y.applyUpdate(document, decodeBytes(source.baseline));
    const seed = await readTextDocumentSeed(document);
    const content = document.getText("content").toString();
    const bytes = new TextEncoder().encode(content);
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
    const hash = Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
    if (bytes.length !== source.asset.byteLength || hash !== source.asset.sha256)
      throw new NativeSourceRecoveryError("A file's original bytes do not match its saved text history");
    return { document, seed, content };
  } catch (error) {
    document.destroy();
    throw error;
  }
};

export const nativeAssetBaseline = async (source: NativeAssetSource) => {
  const { document } = await assetDocument(source);
  try {
    return Y.encodeStateAsUpdate(document);
  } finally {
    document.destroy();
  }
};

export const compatibleNativeAssets = async (left: NativeAssetSource, right: NativeAssetSource) => {
  if (canonicalJson(left.asset) !== canonicalJson(right.asset)) return false;
  const local = await assetDocument(left);
  try {
    const remote = await assetDocument(right);
    try {
      await assertCompatibleTextImports(local.document, remote.document, local.seed.source, remote.seed.source);
      return local.content === remote.content;
    } finally {
      remote.document.destroy();
    }
  } finally {
    local.document.destroy();
  }
};
