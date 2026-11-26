import { useQuery } from "@tanstack/react-query";
import type { ExtensionUpgradeReview } from "pstdio-api-contracts";
import { getApiClient } from "@/lib/api";
import { findUpgradeAgentProposal, importUpgradeAgentProposal } from "./import-upgrade-agent-proposal";

const readReply = async (projectId: string, review: ExtensionUpgradeReview) => {
  const api = getApiClient();
  const { items } = await api.sessions.query(projectId, {
    anchor: { id: review.id, type: "extension-upgrade-review", extensionId: "pstdio", projectId },
    orderBy: "lastActivity",
    includeArchived: true,
    limit: 1,
  });
  const session = items[0];
  if (!session) return { state: "none" } as const;
  if (["queued", "in_progress", "awaiting_input"].includes(session.status)) return { state: "working" } as const;
  const conversation = await api.sessions.getConversation(session.id);
  const proposal = findUpgradeAgentProposal(conversation.messages, review.id);
  if (!proposal) return { state: "missing" } as const;
  if (proposal.revision !== review.revision) return { state: "stale" } as const;
  return { state: "ready", resolutions: importUpgradeAgentProposal(proposal.text, review) } as const;
};

export const useUpgradeAgentReply = (projectId: string, review: ExtensionUpgradeReview | undefined) =>
  useQuery({
    queryKey: ["extension-upgrade-agent-reply", projectId, review?.id, review?.revision],
    queryFn: () => readReply(projectId, review!),
    enabled: Boolean(review),
    refetchInterval: (query) => (query.state.data?.state === "working" ? 3_000 : false),
  });
