import { Button, HStack, Icon, Link, Spinner, Stack, Text } from "@chakra-ui/react";
import type { ExtensionInstallation } from "@pstdio/sdk/api";
import { AlertMessage } from "@pstdio/ui";
import { Check, Puzzle, RotateCcw, TriangleAlert } from "lucide-react";
import type { Translate } from "./messages";

export const installationItems = (jobs: ExtensionInstallation[]) => {
  const groups = new Map<string, ExtensionInstallation[]>();
  for (const job of jobs) {
    const key = JSON.stringify([job.projectId, job.installName]);
    groups.set(key, [...(groups.get(key) ?? []), job]);
  }
  return [...groups.values()].map((group) => {
    group.sort((a, b) => b.queuedAt.localeCompare(a.queuedAt));
    return group.find((job) => job.status === "running") ?? group[0]!;
  });
};
const elapsed = (job: ExtensionInstallation) => {
  const seconds = Math.max(0, Math.floor((Date.now() - Date.parse(job.startedAt ?? job.queuedAt)) / 1_000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};
interface InstallationContentProps {
  jobs: ExtensionInstallation[];
  error?: string;
  t: Translate;
  onRetry: (job: ExtensionInstallation) => void;
  onOpen: (job: ExtensionInstallation) => void;
}
export const InstallationIndicator = (props: Pick<InstallationContentProps, "jobs" | "error" | "t">) => {
  const { jobs, error, t } = props;
  const pending = jobs.find((job) => job.status === "running" || job.status === "queued");
  const failed = error || installationItems(jobs).some((job) => job.status === "failed");
  return (
    <HStack gap="xs" color={failed ? "fg.error" : "fg.muted"} h="full">
      <Icon boxSize="icon-xs">
        <Puzzle />
      </Icon>
      {pending && !failed && <Spinner size="xs" />}
      {failed && (
        <Icon boxSize="icon-xs" aria-label={t("installations.failed")}>
          <TriangleAlert />
        </Icon>
      )}
      {!pending && !failed && jobs.length > 0 && (
        <Icon boxSize="icon-xs" aria-label={t("installations.complete")}>
          <Check />
        </Icon>
      )}
      {pending && <Text textStyle="mono/XS">{elapsed(pending)}</Text>}
    </HStack>
  );
};
export const InstallationContent = (props: InstallationContentProps) => {
  const { jobs, error, t, onRetry, onOpen } = props;
  const items = installationItems(jobs);
  return (
    <Stack gap="sm">
      <HStack gap="xs">
        <Icon boxSize="icon-xs">
          <Puzzle />
        </Icon>
        <Text textStyle="label/M/medium">{t("installations.title")}</Text>
      </HStack>
      {error && (
        <AlertMessage status="error" title={t("installations.failed")}>
          {error}
        </AlertMessage>
      )}
      {!items.length && !error && (
        <Text textStyle="label/S/regular" color="fg.muted">
          {t("installations.empty")}
        </Text>
      )}
      <Stack gap="md" py="xs">
        {items.map((job) => (
          <Stack key={job.id} gap="sm">
            <HStack gap="xs">
              <Icon boxSize="icon-xs" color="fg.muted">
                <Puzzle />
              </Icon>
              <Link
                variant="resource"
                textStyle="label/M/regular"
                flex="1"
                minW="0"
                href={`#extension/${encodeURIComponent(job.installName)}`}
                onClick={(event) => {
                  event.preventDefault();
                  onOpen(job);
                }}
              >
                {job.displayName}
              </Link>
              {job.status === "queued" && (
                <Text textStyle="label/S/regular" color="fg.muted">
                  {t("installations.queued")}
                </Text>
              )}
              {job.status === "running" && (
                <>
                  <Spinner size="xs" color="fg.muted" />
                  <Text textStyle="mono/XS" color="fg.muted">
                    {elapsed(job)}
                  </Text>
                </>
              )}
              {job.status === "completed" && (
                <Icon boxSize="icon-xs" color="fg.muted" aria-label={t("installations.complete")}>
                  <Check />
                </Icon>
              )}
              {job.status === "failed" && (
                <Icon boxSize="icon-xs" color="fg.error" aria-label={t("installations.failed")}>
                  <TriangleAlert />
                </Icon>
              )}
            </HStack>
            {job.status === "failed" && (
              <AlertMessage
                status="error"
                title={t("installations.failed")}
                endElement={
                  <Button onClick={() => onRetry(job)}>
                    <RotateCcw />
                    {t("installations.retry")}
                  </Button>
                }
              >
                {job.error}
              </AlertMessage>
            )}
          </Stack>
        ))}
      </Stack>
    </Stack>
  );
};
