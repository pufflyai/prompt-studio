import { Button, Collapsible, Field, HStack, Stack, Text, Textarea } from "@chakra-ui/react";
import { AlertMessage } from "@pstdio/ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { getApiClient } from "@/lib/api";
import { findUpgradeAgentProposal } from "./import-upgrade-agent-proposal";

export const UpgradeAgentProposalImport = (props: {
  projectId: string;
  reviewId: string;
  onImport: (content: string) => Promise<void>;
  disabled: boolean;
}) => {
  const { t } = useTranslation("projects", { keyPrefix: "projectSettings.extensionsPanel.upgradeReview" });
  const [content, setContent] = useState("");
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState<"find" | "stage">();
  const stage = async () => {
    setError(undefined);
    setPending("stage");
    try {
      await props.onImport(content);
      setContent("");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setPending(undefined);
    }
  };
  const find = async () => {
    setError(undefined);
    setPending("find");
    const api = getApiClient();
    try {
      const { projectId, reviewId } = props;
      const { items } = await api.sessions.query(projectId, {
        anchor: { id: reviewId, type: "extension-upgrade-review", extensionId: "pstdio", projectId },
        orderBy: "lastActivity",
        includeArchived: true,
        limit: 1,
      });
      const session = items[0];
      if (!session)
        throw new Error(t("upgradeSessionMissing", "Start a session with Resolve with agent to load its reply here."));
      if (["queued", "in_progress", "awaiting_input"].includes(session.status))
        throw new Error(t("upgradeSessionPending", "The agent session is still in progress."));
      const conversation = await api.sessions.getConversation(session.id);
      const proposal = findUpgradeAgentProposal(conversation.messages, reviewId);
      if (!proposal) throw new Error(t("noAgentReply", "The session has no proposal for this review yet."));
      setContent(proposal);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setPending(undefined);
    }
  };
  return (
    <Collapsible.Root>
      <Collapsible.Trigger asChild>
        <Button variant="ghost" size="sm">
          {t("importAgent", "Import agent proposal")}
        </Button>
      </Collapsible.Trigger>
      <Collapsible.Content>
        <Stack gap="sm">
          <Text>
            {t("importAgentDescription", "Load or paste an agent proposal. Review it before staging its choices.")}
          </Text>
          {error && (
            <AlertMessage status="error" title={t("importAgentError", "Proposal could not be imported")}>
              {error}
            </AlertMessage>
          )}
          <Field.Root>
            <Field.Label>{t("agentProposal", "Agent proposal")}</Field.Label>
            <Textarea
              value={content}
              rows={4}
              disabled={Boolean(pending)}
              onChange={(event) => setContent(event.target.value)}
            />
          </Field.Root>
          <HStack justify="end">
            <Button
              variant="outline"
              onClick={() => void find()}
              loading={pending === "find"}
              disabled={Boolean(pending) || Boolean(content.trim())}
            >
              {t("loadAgentProposal", "Load agent reply")}
            </Button>
            <Button
              variant="outline"
              onClick={() => void stage()}
              loading={pending === "stage"}
              disabled={!content.trim() || props.disabled || Boolean(pending)}
            >
              {t("saveAgentChoices", "Stage agent choices")}
            </Button>
          </HStack>
        </Stack>
      </Collapsible.Content>
    </Collapsible.Root>
  );
};
