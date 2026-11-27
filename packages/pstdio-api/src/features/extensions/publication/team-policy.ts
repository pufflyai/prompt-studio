import { canonicalExtensionId } from "pstdio-api-contracts/extension-host";
import type { GroupCommit } from "pstdio-sync/records";
import type { StorageRecord, TeamExtensionPolicy } from "pstdio-sync-contracts";
import { AlwaysEnabledExtensionError } from "../always-on-extensions";
import type { CatalogRecords } from "./catalog-store";
import { publicationRemovalSchema } from "./types";

const decisionFor = (policy: TeamExtensionPolicy[], id: string) =>
  policy.find((row) => row.extensionId === canonicalExtensionId(id));

export const assertOrdinaryExtensionChoices = (policy: TeamExtensionPolicy[], ids: string[]) => {
  if (ids.some((id) => decisionFor(policy, id)?.required))
    throw new AlwaysEnabledExtensionError("This extension is managed by your team owner and must stay enabled.");
};

const objectValue = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

export const publicationRemoved = (record: Pick<StorageRecord, "deleted" | "value">) =>
  record.deleted || publicationRemovalSchema.safeParse(record.value).success;

/** A released tool accepts ordinary choices only from its current owner-issued decision. */
export const ordinaryPublicationAllowed = (policy: TeamExtensionPolicy[], id: string, value: unknown) => {
  const decision = decisionFor(policy, id);
  return !decision || (!decision.required && objectValue(value).teamPolicyRevision === decision.selectionId);
};

export const stampTeamPolicyChoices = async (
  records: Pick<CatalogRecords, "read">,
  policy: TeamExtensionPolicy[],
  group: GroupCommit,
) => {
  const edits = await Promise.all(
    group.edits.map(async (edit) => {
      if (edit.recordId.startsWith("package:")) return edit;
      assertOrdinaryExtensionChoices(policy, [edit.recordId]);
      const decision = decisionFor(policy, edit.recordId);
      if (!decision) return edit;
      // Physical tombstones discard their value. A logical removal keeps its policy decision
      // in the same atomic edit, so earlier shared deletions cannot impersonate a new choice.
      const stamped: GroupCommit["edits"][number] = { ...edit };
      if (edit.deleted) {
        stamped.deleted = false;
        stamped.replace = { removed: true, teamPolicyRevision: decision.selectionId };
        stamped.asset = null;
      } else {
        const previous = await records.read(edit.recordId);
        stamped.replace = {
          ...objectValue(edit.replace === undefined ? previous.value : edit.replace),
          teamPolicyRevision: decision.selectionId,
        };
      }
      return stamped;
    }),
  );
  return { ...group, edits };
};
