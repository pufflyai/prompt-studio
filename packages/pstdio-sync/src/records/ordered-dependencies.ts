import { overlappingJsonStamps } from "./ordered-json";
import type { OrderedOperation } from "./ordered-operation";

const conditionStamps = (edit: OrderedOperation["edits"][number]) => {
  if (!edit.condition) return [];
  const condition = edit.condition;
  if (!("stamps" in condition)) return [condition.lifetime];
  const lifecycle = edit.deleted === true || (edit.deleted === false && condition.deleted);
  const paths = [...edit.changes, ...(edit.texts ?? []).map((text) => ({ path: text.path, remove: true as const }))];
  const stamps = overlappingJsonStamps(condition.stamps, lifecycle ? [{ path: [], remove: true }] : paths);
  return [condition.lifetime, ...Object.values(stamps)];
};

/** A base written over this device's own pending saves resolves through their exact receipts. */
const baseStamps = (edit: OrderedOperation["edits"][number]) =>
  edit.base ? [edit.base.lifetime, ...Object.values(edit.base.stamps)] : [];

export const operationDependencies = (operation: OrderedOperation) => {
  const references = new Map<string, string>();
  for (const edit of operation.edits) {
    for (const text of edit.texts ?? [])
      for (const dependency of text.dependencies) references.set(dependency.operationId, dependency.fingerprint);
    for (const stamp of [...conditionStamps(edit), ...baseStamps(edit)]) {
      if (!stamp || stamp === "initial") continue;
      const [kind, id, fingerprint] = JSON.parse(stamp) as string[];
      if (kind === "pending") references.set(id!, fingerprint!);
    }
  }
  return references;
};
