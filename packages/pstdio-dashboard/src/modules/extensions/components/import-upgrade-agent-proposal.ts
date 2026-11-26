import {
  type ExtensionUpgradeReview,
  extensionUpgradeAgentProposalSchema,
  type SessionMessage,
} from "pstdio-api-contracts";

const parseProposal = (content: string) => {
  const json = /```(?:json)?\s*([\s\S]+?)```/i.exec(content)?.[1] ?? content;
  return extensionUpgradeAgentProposalSchema.parse(JSON.parse(json));
};

export const findUpgradeAgentProposal = (messages: SessionMessage[], reviewId: string) => {
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index]!;
    if (message.role !== "assistant") continue;
    const text = message.parts.flatMap((part) => (part.type === "text" ? [part.text] : [])).join("");
    try {
      if (parseProposal(text).reviewId === reviewId) return text;
    } catch {
      // Explanatory replies may precede the structured proposal.
    }
  }
};

export const importUpgradeAgentProposal = (content: string, review: ExtensionUpgradeReview) => {
  const proposal = parseProposal(content);
  if (proposal.reviewId !== review.id || proposal.revision !== review.revision)
    throw new Error("This proposal is for a different revision of the upgrade review.");
  const merged = new Map(review.resolutions.map((choice) => [choice.path, choice]));
  const paths = new Set<string>();
  for (const choice of proposal.resolutions) {
    if (paths.has(choice.path) || merged.has(choice.path))
      throw new Error(`The proposal repeats a resolution already recorded for ${choice.path}.`);
    paths.add(choice.path);
    merged.set(choice.path, choice);
  }
  return [...merged.values()];
};
