import { Button, CloseButton, Dialog, Field, Portal, Stack, Text, Textarea } from "@chakra-ui/react";
import { PstdioApiError } from "@pstdio/sdk/client";
import { AlertMessage } from "@pstdio/ui";
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
  const [keeping, setKeeping] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const apply = useApplyExtensionUpgradeReview(projectId);
  const reply = useUpgradeAgentReply(projectId, review);
  const instanceId = target.extension.id;
  const resolutions = reply.data?.state === "ready" ? reply.data.resolutions : (review?.resolutions ?? []);
  const resolvedPaths = new Set(resolutions.map(({ path }) => path));
  const ready = Boolean(
    review && !stale && review.changes.every(({ status, path }) => status !== "conflict" || resolvedPaths.has(path)),
  );
  const busy = submitting || starting || keeping;
  const working = reply.data?.state === "working";
  const showAgentAction = onCompose && !ready;

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
    if (!onCompose || busy || working) return;
    setError(undefined);
    setStarting(true);
    try {
      let current = review ?? (await target.load);
      if (stale || current.changedPaths) {
        const result = await getApiClient().extensions.reviewUpgrade(projectId, instanceId, {
          action: "refresh",
          id: current.id,
          revision: current.revision,
          resolutions: current.resolutions,
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

  const keepCurrent = async () => {
    if (busy) return;
    setKeeping(true);
    setError(undefined);
    try {
      if (review)
        await getApiClient().extensions.reviewUpgrade(projectId, instanceId, {
          action: "cancel",
          id: review.id,
          revision: review.revision,
        });
      onApplied();
      onClose();
    } catch (failure) {
      setError(messageFrom(failure));
    } finally {
      setKeeping(false);
    }
  };

  const submit = async (usePublished = false) => {
    if (!review || (!ready && !usePublished) || busy) return;
    setError(undefined);
    setSubmitting(true);
    try {
      const current =
        usePublished && stale
          ? (
              await getApiClient().extensions.reviewUpgrade(projectId, instanceId, {
                action: "refresh",
                id: review.id,
                revision: review.revision,
              })
            ).review
          : review;
      setReview(current);
      setStale(Boolean(current.changedPaths));
      await apply.mutateAsync({
        instanceId,
        id: current.id,
        resolutions: usePublished ? [] : resolutions,
        usePublished,
        revision: current.revision,
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
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog.Root
      open
      placement="center"
      size="sm"
      scrollBehavior="inside"
      closeOnInteractOutside={false}
      onOpenChange={({ open }) => !open && !busy && onClose()}
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>
                {t("title", "Review {{name}} upgrade", { name: target.extension.displayName })}
              </Dialog.Title>
              <Dialog.CloseTrigger asChild>
                <CloseButton size="sm" aria-label={t("close", "Close review")} disabled={busy} />
              </Dialog.CloseTrigger>
            </Dialog.Header>
            <Dialog.Body>
              <Stack gap="sm">
                {error && (
                  <AlertMessage status="error" title={t("error", "Upgrade review")}>
                    {error}
                  </AlertMessage>
                )}
                {!review && (
                  <Text>{t("currentStaysActive", "Your extension stays active until you apply the upgrade.")}</Text>
                )}
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
                  </>
                )}
                {!onCompose && !ready && (
                  <Text>{t("agentUnavailable", "The session composer is unavailable in this project.")}</Text>
                )}
                {showAgentAction && !working && (
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
              </Stack>
            </Dialog.Body>
            <Dialog.Footer flexWrap="wrap">
              <Button variant="outline" loading={keeping} disabled={busy} onClick={() => void keepCurrent()}>
                {t("keepMyVersion", "Keep my version")}
              </Button>
              <Button
                variant="outline"
                disabled={!review || busy}
                loading={submitting}
                onClick={() => void submit(true)}
              >
                {t("useTheirVersion", "Use their version")}
              </Button>
              {ready && (
                <Button loading={submitting} disabled={busy || working} onClick={() => void submit()}>
                  {t("apply", "Apply upgrade")}
                </Button>
              )}
              {showAgentAction && (
                <Button
                  loading={starting}
                  disabled={busy || working || (!review && Boolean(error))}
                  onClick={() => void startAgent()}
                >
                  {t("askAgentAction", "Ask agent")}
                </Button>
              )}
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
};
