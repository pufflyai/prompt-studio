import {
  type ActivityAuthor,
  type PublishResourceActivity,
  type ResourceActivityEntry,
  resourceActivityEntrySchema,
} from "pstdio-api-contracts";
import { type ResourceRef, resourceKey } from "pstdio-api-contracts/extension-kernel";

interface Reader {
  read(id: string): Promise<{ value: unknown; exists: boolean; deleted: boolean }>;
}
const revisionKey = (value: ResourceActivityEntry["revision"]) =>
  value && JSON.stringify([value.workspaceId, value.headSha, value.baseSha, value.revision, value.attemptId]);
const reviewReference = async (
  records: Reader,
  resource: ResourceRef,
  input: PublishResourceActivity,
  author: ActivityAuthor,
) => {
  const implementation = resourceActivityEntrySchema.parse(
    (await records.read(`entry/${input.implementationId}`)).value,
  );
  if (
    resourceKey(implementation.resource) !== resourceKey(resource) ||
    implementation.kind !== "implementation" ||
    revisionKey(implementation.revision) !== revisionKey(input.revision)
  )
    throw new Error("Review must name the exact implementation revision on this resource.");
  if (implementation.author.id === author.id)
    throw new Error("An independent reviewer must differ from the implementer.");
};
export const activityEntryLinks = async (
  records: Reader,
  resource: ResourceRef,
  input: PublishResourceActivity,
  author: ActivityAuthor,
) => {
  if (input.replyToId) {
    const parent = resourceActivityEntrySchema.parse((await records.read(`entry/${input.replyToId}`)).value);
    if (resourceKey(parent.resource) !== resourceKey(resource) || parent.kind !== "comment" || parent.replyToId)
      throw new Error("Reply requires a discussion on this resource.");
  }
  if (input.kind === "review") await reviewReference(records, resource, input, author);
  const attachments: ResourceActivityEntry["attachments"] = [];
  for (const attachmentId of input.attachmentIds ?? []) {
    const attachment = await records.read(`attachment/${attachmentId}`);
    const value = attachment.value as { scope?: string; attachment?: ResourceActivityEntry["attachments"][number] };
    if (!attachment.exists || attachment.deleted || value?.scope !== resourceKey(resource) || !value.attachment)
      throw new Error("Attachment belongs to another resource.");
    attachments.push(value.attachment);
  }
  return attachments;
};
