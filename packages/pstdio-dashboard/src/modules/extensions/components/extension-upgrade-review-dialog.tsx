import { Button, Dialog, Field, Portal, Stack, Text, Textarea } from "@chakra-ui/react";
import { PstdioApiError } from "@pstdio/sdk/client";
import { AlertMessage, LoadingState } from "@pstdio/ui";
import {
  type ExtensionUpgradeReview,
  type ProjectExtensionInstance,
  staleExtensionUpgradeReviewDetailsSchema,
} from "pstdio-api-contracts";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getApiClient } from "@/lib/api";
import { useApplyExtensionUpgradeReview } from "@/shared/extensions/use-project-extensions";
import { useUpgradeAgentReply } from "./use-upgrade-agent-reply";

export type ReviewTarget = {
  extension: ProjectExtensionInstance;
  load: Promise<ExtensionUpgradeReview>;
};

type Props = {
  projectId: string;
  target: ReviewTarget;
  onClose: () => void;
  onApplied: () => void;
  onCompose?: (review: ExtensionUpgradeReview, instructions: string) => Promise<void>;
};
const messageFrom = (error: unknown) => (error instanceof Error ? error.message : String(error));

const AgentReplyStatus = ({
  ready,
  stale,
  reply,
}: {
  ready: boolean;
  stale: boolean;
  reply: ReturnType<typeof useUpgradeAgentReply>;
}) => {
  const { t } = useTranslation("projects", { keyPrefix: "projectSettings.extensionsPanel.upgradeReview" });
  if (reply.data?.state === "working")
    return <Text role="status">{t("agentWorking", "The agent is working on this upgrade.")}</Text>;
  if (stale) return null;
  if (ready && reply.data?.state === "ready")
    return <Text role="status">{t("agentReady", "The agent prepared a resolution.")}</Text>;
  if (reply.isError || (reply.data && reply.data.state !== "none"))
    return (
      <Text role="status">
        {t(
          "agentIncomplete",
          "There is no complete resolution for this comparison. Start another session to continue.",
        )}
      </Text>
    );
  return null;
};

export const ExtensionUpgradeReviewDialog = ({ projectId, target, onClose, onApplied, onCompose }: Props) => {
  const { t } = useTranslation("projects", { keyPrefix: "projectSettings.extensionsPanel.upgradeReview" });
  const [review, setReview] = useState<ExtensionUpgradeReview>();
  const [error, setError] = useState<string>();
  const [stale, setStale] = useState(false);
  const [instructions, setInstructions] = useState("");
  const [starting, setStarting] = useState(false);
  const apply = useApplyExtensionUpgradeReview(projectId);
  const reply = useUpgradeAgentReply(projectId, review);
  const instanceId = target.extension.id;
  const resolutions = reply.data?.state === "ready" ? reply.data.resolutions : (review?.resolutions ?? []);
  const resolvedPaths = new Set(resolutions.map(({ path }) => path));
  const ready = Boolean(
    review && !stale && review.changes.every(({ status, path }) => status !== "conflict" || resolvedPaths.has(path)),
  );
  const busy = apply.isPending || starting;
  const working = reply.data?.state === "working";

  useEffect(() => {
    let current = true;
    target.load.then(
      (result) => {
        if (!current) return;
        setReview(result);
        setStale(Boolean(result.changedPaths));
      },
      (failure: unknown) => {
        if (current) setError(messageFrom(failure));
      },
    );
    return () => {
      current = false;
    };
  }, [target]);

  const startAgent = async () => {
    if (!review || !onCompose || busy || working) return;
    setError(undefined);
    setStarting(true);
    try {
      let current = review;
      if (stale) {
        const result = await getApiClient().extensions.reviewUpgrade(projectId, instanceId, {
          action: "refresh",
          id: review.id,
          revision: review.revision,
          resolutions: review.resolutions,
        });
        current = result.review;
        setReview(current);
        setStale(Boolean(current.changedPaths));
      }
      await onCompose(current, instructions.trim());
      onClose();
    } catch (failure) {
      setError(messageFrom(failure));
    } finally {
      setStarting(false);
    }
  };

  const submit = async () => {
    if (!review || !ready || busy) return;
    setError(undefined);
    try {
      await apply.mutateAsync({
        instanceId,
        id: review.id,
        resolutions,
        revision: review.revision,
        title: t("applying", "Applying extension upgrade"),
      });
      onApplied();
      onClose();
    } catch (failure) {
      const details = staleExtensionUpgradeReviewDetailsSchema.safeParse(
        failure instanceof PstdioApiError ? failure.details : undefined,
      );
      if (details.success) setStale(true);
      else setError(messageFrom(failure));
    }
  };

  return (
    <Dialog.Root open closeOnInteractOutside={false} onOpenChange={({ open }) => !open && !busy && onClose()}>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>
                {t("title", "Review {{name}} upgrade", { name: target.extension.displayName })}
              </Dialog.Title>
            </Dialog.Header>
            <Dialog.CloseTrigger asChild>
              <Button variant="ghost" size="sm" disabled={busy}>
                {t("close", "Close review")}
              </Button>
            </Dialog.CloseTrigger>
            <Dialog.Body>
              <Stack gap="sm">
                {error && (
                  <AlertMessage status="error" title={t("error", "Upgrade review")}>
                    {error}
                  </AlertMessage>
                )}
                {!review && !error && <LoadingState />}
                {review && (
                  <>
                    <Text>
                      {t("summary", "Incoming version {{version}}. Your extension stays active until you apply.", {
                        version: review.incomingVersion,
                      })}
                    </Text>
                    {review.separateLocalProvider && (
                      <Text>
                        {t("localProviderPath", "This project uses the local copy at {{path}}.", {
                          path: review.localPath,
                        })}
                      </Text>
                    )}
                    {!review.hasOriginal && <Text>{t("unknownOriginal", "Original release unavailable")}</Text>}
                    {stale && (
                      <AlertMessage
                        status="warning"
                        title={t("sourceChanged", "The extension source changed during this review")}
                      >
                        {t("agentRefresh", "A new session will use the latest files.")}
                      </AlertMessage>
                    )}
                    <AgentReplyStatus ready={ready} stale={stale} reply={reply} />
                    {!onCompose && !ready && (
                      <Text>{t("agentUnavailable", "The session composer is unavailable in this project.")}</Text>
                    )}
                    {!ready && onCompose && !working && (
                      <Field.Root>
                        <Field.Label>{t("agentInstructions", "Additional instructions (optional)")}</Field.Label>
                        <Textarea
                          rows={3}
                          value={instructions}
                          maxLength={4000}
                          disabled={busy}
                          onChange={(event) => setInstructions(event.target.value)}
                        />
                      </Field.Root>
                    )}
                  </>
                )}
              </Stack>
            </Dialog.Body>
            <Dialog.Footer>
              {ready && (
                <Button loading={apply.isPending} disabled={busy || working} onClick={() => void submit()}>
                  {t("apply", "Apply upgrade")}
                </Button>
              )}
              {onCompose && !ready && (
                <Button loading={starting} disabled={!review || busy || working} onClick={() => void startAgent()}>
                  {t("askAgent", "Resolve with agent")}
                </Button>
              )}
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
};
