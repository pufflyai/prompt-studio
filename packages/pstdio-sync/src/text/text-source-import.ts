import { fingerprint } from "pstdio-sync-contracts";
import type * as Y from "yjs";
import { NativeSourceRecoveryError } from "../shared";
import { readTextDocumentSeed, seedTextDocument } from "./text-document-seed";

interface ImportFact {
  source: string;
  baseline: string;
}
const importsKey = "text-source-imports";
const facts = (document: Y.Doc) => {
  const entries = [...document.getMap<ImportFact>(importsKey)];
  for (const [seed, fact] of entries) {
    if (
      !/^[a-f0-9]{64}$/.test(seed) ||
      !fact ||
      !/^[a-f0-9]{64}$/.test(fact.source) ||
      !/^[a-f0-9]{64}$/.test(fact.baseline)
    )
      throw new Error("Invalid text source import provenance");
  }
  return entries;
};
export const hasTextSourceImport = (document: Y.Doc, key: string) =>
  facts(document).some(([, fact]) => fact.source === key);
export const carryTextSourceImports = (source: Y.Doc, target: Y.Doc) => {
  const imports = target.getMap<ImportFact>(importsKey);
  for (const [seed, fact] of facts(source)) {
    const existing = imports.get(seed);
    if (existing && (existing.source !== fact.source || existing.baseline !== fact.baseline))
      throw new NativeSourceRecoveryError("An imported text history has conflicting source provenance");
    if (!existing) imports.set(seed, fact);
  }
};
/** Retain one immutable import fact for this exact history, independently of its current root. */
export const importTextSource = async (document: Y.Doc, key: string, source: string) => {
  await seedTextDocument(document, source);
  const initial = await readTextDocumentSeed(document);
  if (initial.source !== source && document.getText("content").toString() !== source)
    throw new NativeSourceRecoveryError("A pre-binding source copy needs recovery; its bytes are preserved");
  const fact = { source: key, baseline: await fingerprint(initial.source) };
  const imports = document.getMap<ImportFact>(importsKey);
  const existing = imports.get(initial.id);
  if (existing && (existing.source !== fact.source || existing.baseline !== fact.baseline))
    throw new NativeSourceRecoveryError("An imported text history has conflicting source provenance");
  if (!existing) imports.set(initial.id, fact);
};

export const assertCompatibleTextImports = async (local: Y.Doc, remote: Y.Doc, left: string, right: string) => {
  const imported = [...facts(local), ...facts(remote)];
  if (!imported.length) return;
  const [first] = imported;
  const leftHash = await fingerprint(left);
  const rightHash = await fingerprint(right);
  for (const [, fact] of imported) {
    if (fact.source !== first![1].source || fact.baseline !== leftHash || fact.baseline !== rightHash)
      throw new NativeSourceRecoveryError(
        "Different pre-binding source copies need recovery; both histories are preserved",
      );
  }
};
