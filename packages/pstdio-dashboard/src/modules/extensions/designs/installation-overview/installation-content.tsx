import { Button, HStack, Icon, IconButton, Spinner, Stack, Text } from "@chakra-ui/react";
import { AlertMessage, PopoverHeader, resolveIconComponent } from "@pstdio/ui";
import { Check, Puzzle, RotateCcw, TriangleAlert, X } from "lucide-react";
import { formatDuration, installationDuration } from "./installation-duration";
import { installationItems } from "./installation-jobs";
import type { Translate } from "./messages";
import type { InstallationPreviewJob } from "./types";

interface InstallationContentProps {
  jobs: InstallationPreviewJob[];
  error?: string;
  t: Translate;
  onRetry: (job: InstallationPreviewJob) => void;
  onDismiss: () => void;
  loading?: boolean;
}
export const InstallationIndicator = (props: Pick<InstallationContentProps, "jobs" | "error" | "t">) => {
  const { jobs, error, t } = props;
  const items = installationItems(jobs);
  const pending = items.find((job) => job.status === "running" || job.status === "queued");
  const failed = error || items.some((job) => job.status === "failed");
  if (!items.length && !failed) return null;
  return (
    <Button
      variant="ghost"
      size="xs"
      role="status"
      aria-label={t("installations.title")}
      gap="xs"
      color={failed ? "fg.error" : "fg.muted"}
      h="full"
    >
      <Icon boxSize="icon-xs">
        <Puzzle />
      </Icon>
      {pending && !failed && <Spinner size="xs" />}
      {failed && (
        <Icon boxSize="icon-xs" aria-label={t("installations.failed")}>
          <TriangleAlert />
        </Icon>
      )}
      <Text textStyle="label/S/regular">{t("installations.description")}</Text>
      {items.length > 0 && <Text textStyle="mono/XS">{formatDuration(installationDuration(jobs))}</Text>}
    </Button>
  );
};
const InstallationIcon = ({ name }: { name?: string }) => {
  if (name?.startsWith("data:image/svg+xml;base64,")) {
    return (
      <Icon boxSize="icon-sm" colorScheme="light" _dark={{ colorScheme: "dark" }} asChild>
        <img src={name} alt="" />
      </Icon>
    );
  }
  const Glyph = (name && resolveIconComponent(name)) || Puzzle;
  return (
    <Icon boxSize="icon-sm" color="fg.muted">
      <Glyph />
    </Icon>
  );
};
export const InstallationContent = (props: InstallationContentProps) => {
  const { jobs, error, t, onRetry, onDismiss, loading } = props;
  const items = installationItems(jobs);
  return (
    <Stack gap="0">
      <PopoverHeader
        icon={<Puzzle />}
        title={t("installations.title")}
        actions={
          <IconButton aria-label={t("installations.dismiss")} onClick={onDismiss}>
            <X />
          </IconButton>
        }
      />
      <Stack gap="sm" px="md" pb="sm">
        {error && (
          <AlertMessage status="error" title={t("installations.failed")}>
            {error}
          </AlertMessage>
        )}
        {loading && <Spinner size="sm" role="status" aria-label={t("installations.loading")} />}
        {!loading && !items.length && !error && (
          <Text textStyle="label/S/regular" color="fg.muted">
            {t("installations.empty")}
          </Text>
        )}
        <Stack gap="md" py="xs">
          {items.map((job) => (
            <Stack key={job.id} gap="sm">
              <HStack gap="xs">
                <InstallationIcon name={job.icon} />
                <Text textStyle="label/M/regular" flex="1" minW="0">
                  {job.displayName}
                </Text>
                {job.status === "queued" && (
                  <Text textStyle="label/S/regular" color="fg.muted">
                    {t("installations.queued")}
                  </Text>
                )}
                {job.status === "running" && (
                  <>
                    <Spinner size="xs" color="fg.muted" />
                    <Text textStyle="mono/XS" color="fg.muted">
                      {formatDuration(installationDuration([job]))}
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
    </Stack>
  );
};
