import { Button, Dialog, Grid, Portal, Stack, Text } from "@chakra-ui/react";
import { PstdioApiError } from "@pstdio/sdk/client";
import { AlertMessage, LoadingState } from "@pstdio/ui";
import {
  type ExtensionUpgradeReview,
  type ExtensionUpgradeReviewResolution,
  type ProjectExtensionInstance,
  staleExtensionUpgradeReviewDetailsSchema,
} from "pstdio-api-contracts";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getApiClient } from "@/lib/api";
import { useApplyExtensionUpgradeReview } from "@/shared/extensions/use-project-extensions";
import { ExtensionUpgradeReviewFileView } from "./extension-upgrade-review-file-view";
import { PreviousReviewChoices, ReviewSourceSummary, StaleReviewNotice } from "./extension-upgrade-review-notices";
import { importUpgradeAgentProposal } from "./import-upgrade-agent-proposal";
import { UpgradeAgentProposalImport } from "./upgrade-agent-proposal-import";

export type ReviewTarget = {
  extension: ProjectExtensionInstance;
  load: Promise<ExtensionUpgradeReview>;
};

type Props = {
  projectId: string;
  target: ReviewTarget;
  onClose: () => void;
  onApplied: () => void;
  onCompose?: (review: ExtensionUpgradeReview) => Promise<void>;
};
const messageFrom = (error: unknown) => (error instanceof Error ? error.message : String(error));

export const ExtensionUpgradeReviewDialog = ({ projectId, target, onClose, onApplied, onCompose }: Props) => {
  const { t } = useTranslation("projects", { keyPrefix: "projectSettings.extensionsPanel.upgradeReview" });
  const [review, setReview] = useState<ExtensionUpgradeReview>();
  const [error, setError] = useState<string>();
  const [changedPaths, setChangedPaths] = useState<string[]>();
  const [preparingAgent, setPreparingAgent] = useState(false);
  const [validating, setValidating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [validated, setValidated] = useState<Map<string, ExtensionUpgradeReviewResolution>>();
  const [selected, setSelected] = useState<string>();
  const [choices, setChoices] = useState(new Map<string, ExtensionUpgradeReviewResolution>());
  const apply = useApplyExtensionUpgradeReview(projectId);
  const instanceId = target.extension.id;
  const busy = apply.isPending || preparingAgent || validating || refreshing;
  useEffect(() => {
    let current = true;
    target.load.then(
      (result) => {
        if (!current) return;
        setReview(result);
        setChangedPaths(result.changedPaths);
        setChoices(new Map(result.resolutions.map((choice) => [choice.path, choice])));
        setSelected((result.changes.find(({ status }) => status === "conflict") ?? result.changes[0])?.path);
      },
      (failure: unknown) => {
        if (current) setError(messageFrom(failure));
      },
    );
    return () => {
      current = false;
    };
  }, [target]);
  const reportReviewFailure = (failure: unknown) => {
    const stale = staleExtensionUpgradeReviewDetailsSchema.safeParse(
      failure instanceof PstdioApiError ? failure.details : undefined,
    );
    if (stale.success) setChangedPaths(stale.data.changedPaths);
    else setError(messageFrom(failure));
  };
  const close = () => {
    if (busy) return;
    onClose();
    void target.load
      .then(({ id }) => getApiClient().extensions.reviewUpgrade(projectId, instanceId, { action: "cancel", id }))
      .catch(() => {});
  };
  const saveDraft = async (resolutions: ExtensionUpgradeReviewResolution[]) => {
    if (!review) throw new Error("The upgrade review is still loading.");
    const { review: saved } = await getApiClient().extensions.reviewUpgrade(projectId, instanceId, {
      action: "save",
      id: review.id,
      revision: review.revision,
      resolutions,
    });
    setReview(saved);
    setChoices(new Map(saved.resolutions.map((choice) => [choice.path, choice])));
    return saved;
  };
  const saveAndClose = async () => {
    if (busy) return;
    try {
      if (review && hasUnsavedChoices) await saveDraft([...choices.values()]);
      onClose();
    } catch (failure) {
      setError(messageFrom(failure));
    }
  };
  const askAgent = async () => {
    if (!review || !onCompose || preparingAgent) return;
    setPreparingAgent(true);
    try {
      const saved = hasUnsavedChoices ? await saveDraft([...choices.values()]) : review;
      await onCompose(saved);
      onClose();
    } catch (failure) {
      setError(messageFrom(failure));
    } finally {
      setPreparingAgent(false);
    }
  };
  const importProposal = async (content: string) => {
    if (!review) return;
    if (hasUnsavedChoices)
      throw new Error(t("saveFirst", "Close and reopen this review to save your latest choices before importing."));
    await saveDraft(importUpgradeAgentProposal(content, review));
  };
  const validate = async () => {
    if (!review) return;
    setError(undefined);
    setValidating(true);
    try {
      await getApiClient().extensions.reviewUpgrade(projectId, instanceId, {
        action: "validate",
        id: review.id,
        revision: review.revision,
        resolutions: [...choices.values()],
      });
      setValidated(choices);
    } catch (failure) {
      reportReviewFailure(failure);
    } finally {
      setValidating(false);
    }
  };
  const refresh = async () => {
    if (!review || busy) return;
    setRefreshing(true);
    setError(undefined);
    try {
      const { review: updated } = await getApiClient().extensions.reviewUpgrade(projectId, instanceId, {
        action: "refresh",
        id: review.id,
        revision: review.revision,
        resolutions: [...choices.values()],
      });
      setReview(updated);
      setChangedPaths(updated.changedPaths);
      setChoices(new Map(updated.resolutions.map((choice) => [choice.path, choice])));
      setSelected((updated.changes.find(({ status }) => status === "conflict") ?? updated.changes[0])?.path);
    } catch (failure) {
      setError(messageFrom(failure));
    } finally {
      setRefreshing(false);
    }
  };
  const submit = async (usePublished = false) => {
    if (!review) return;
    setError(undefined);
    try {
      await apply.mutateAsync({
        instanceId,
        id: review.id,
        resolutions: usePublished ? [] : [...choices.values()],
        usePublished,
        revision: review.revision,
        title: t("applying", "Applying extension upgrade"),
      });
      onApplied();
      onClose();
    } catch (failure) {
      reportReviewFailure(failure);
    }
  };
  const hasUnsavedChoices = Boolean(
    review &&
      (choices.size !== review.resolutions.length ||
        review.resolutions.some((choice) => choices.get(choice.path) !== choice)),
  );
  const count = review?.changes.filter(({ path, status }) => status === "conflict" && !choices.has(path)).length ?? 0;
  return (
    <Dialog.Root
      open
      size="xl"
      scrollBehavior="inside"
      closeOnInteractOutside={false}
      onOpenChange={({ open }) => !open && void saveAndClose()}
    >
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
              <Button variant="ghost" size="sm">
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
                {review && changedPaths && (
                  <StaleReviewNotice paths={changedPaths} busy={busy} onRefresh={() => void refresh()} />
                )}
                {!review && !error && <LoadingState />}
                {review && (
                  <>
                    <ReviewSourceSummary review={review} />
                    {Boolean(review.previousResolutions?.length) && (
                      <PreviousReviewChoices choices={review.previousResolutions ?? []} />
                    )}
                    {count > 0 && (
                      <Text role="status">{t("conflicts", "{{count}} conflicts need a choice", { count })}</Text>
                    )}
                    {onCompose && count > 0 && !changedPaths && (
                      <Button
                        variant="outline"
                        size="sm"
                        alignSelf="start"
                        loading={preparingAgent}
                        onClick={() => void askAgent()}
                        disabled={apply.isPending}
                      >
                        {t("askAgent", "Resolve with agent")}
                      </Button>
                    )}
                    <UpgradeAgentProposalImport
                      projectId={projectId}
                      reviewId={review.id}
                      revision={review.revision}
                      onImport={importProposal}
                      disabled={busy || Boolean(changedPaths)}
                    />
                    {validated === choices && !changedPaths && (
                      <AlertMessage
                        status="success"
                        title={t("validationPassed", "Staged extension passed validation")}
                      />
                    )}
                    <ReviewFileComparison
                      review={review}
                      selected={selected}
                      onSelect={setSelected}
                      choices={choices}
                      onChoose={(choice) => setChoices((current) => new Map(current).set(choice.path, choice))}
                      projectId={projectId}
                      instanceId={instanceId}
                      busy={busy}
                    />
                  </>
                )}
              </Stack>
            </Dialog.Body>
            <Dialog.Footer>
              <Button variant="outline" onClick={close} disabled={busy}>
                {t("keepCurrent", "Keep current version")}
              </Button>
              <Button
                variant="outline"
                onClick={() => void validate()}
                disabled={busy || count > 0 || !review || Boolean(changedPaths)}
                loading={validating}
              >
                {t("validate", "Validate staged changes")}
              </Button>
              {review?.separateLocalProvider && (
                <Button variant="outline" onClick={() => void submit(true)} disabled={busy || Boolean(changedPaths)}>
                  {t("usePublished", "Use published version")}
                </Button>
              )}
              <Button
                loading={busy}
                disabled={!review || count > 0 || Boolean(changedPaths)}
                onClick={() => void submit()}
              >
                {review?.separateLocalProvider ? t("applyPort", "Use merged version") : t("apply", "Apply upgrade")}
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
};

const ReviewFileComparison = (props: {
  review: ExtensionUpgradeReview;
  selected: string | undefined;
  onSelect: (path: string) => void;
  choices: ReadonlyMap<string, ExtensionUpgradeReviewResolution>;
  onChoose: (choice: ExtensionUpgradeReviewResolution) => void;
  projectId: string;
  instanceId: string;
  busy: boolean;
}) => {
  const { review, selected, onSelect, choices, onChoose, projectId, instanceId, busy } = props;
  const active = review.changes.find(({ path }) => path === selected);
  return (
    <Grid templateColumns={{ base: "minmax(0, 1fr)", md: "minmax(10rem, 1fr) minmax(0, 3fr)" }} gap="md">
      <Stack gap="xs" maxH="22rem" overflowY="auto">
        {review.changes.map((change) => (
          <Button
            key={change.path}
            variant={change.path === selected ? "outline" : "ghost"}
            justifyContent="start"
            whiteSpace="normal"
            h="auto"
            py="xs"
            overflowWrap="anywhere"
            aria-pressed={change.path === selected}
            onClick={() => onSelect(change.path)}
          >
            {change.path}
            {change.status === "conflict" && !choices.has(change.path) ? " •" : ""}
          </Button>
        ))}
      </Stack>
      {active && (
        <ExtensionUpgradeReviewFileView
          key={`${review.revision}:${active.path}`}
          projectId={projectId}
          instanceId={instanceId}
          id={review.id}
          revision={review.revision}
          disabled={busy}
          change={active}
          choice={choices.get(active.path)}
          onChoose={onChoose}
        />
      )}
    </Grid>
  );
};
