import { HStack, Icon, Spinner, Text } from "@chakra-ui/react";
import { resolveIconComponent } from "@pstdio/ui";
import { useCloudContext } from "./cloud-context";
import { cloudStatus } from "./status";
import type { useCloud } from "./use-cloud";

export const CloudIcon = (props: { name: string }) => {
  const { name } = props;
  return <Icon as={resolveIconComponent(name)} boxSize="4" aria-hidden="true" />;
};

const CloudStatusIcon = (props: { status?: ReturnType<typeof cloudStatus>; active?: boolean; error?: string }) => {
  const { status, active, error } = props;
  if (active) return <Spinner size="xs" />;
  let icon = status?.icon ?? "cloud";
  if (error) icon = "triangle-alert";
  if (status?.key === "offline") icon = "wifi-off";
  return <CloudIcon name={icon} />;
};

export const CloudLabel = (props: { data: ReturnType<typeof useCloud>["data"]; error?: string }) => {
  const { data, error } = props;
  const { t } = useCloudContext();
  const status = data ? cloudStatus(data.account, data.sync, data.project) : undefined;
  let label = t("status.loading", "Cloud");
  if (status?.key === "offline") label = t("status.offline", "Connection lost");
  else if (error) label = t("status.attention", "Needs attention");
  else if (data?.signingIn) label = t("status.signingIn", "Signing in…");
  else if (status) {
    switch (status.key) {
      case "signIn":
        label = t("status.signIn", "Sign in");
        break;
      case "signInAgain":
        label = t("status.signInAgain", "Sign in again");
        break;
      case "signedIn":
        label = t("status.signedIn", "Signed in");
        break;
      case "local":
        label = t("status.local", "Local");
        break;
      case "offline":
        label = t("status.offline", "Connection lost");
        break;
      case "attention":
        label = t("status.attention", "Needs attention");
        break;
      case "preparing":
        label = t("status.preparing", "Preparing project");
        break;
      case "downloading":
        label =
          status.percent === undefined
            ? t("status.downloading", "Downloading")
            : t("status.downloadingPercent", "Downloading {{percent}}%", { percent: status.percent });
        break;
      case "syncing":
        label =
          status.count === undefined
            ? t("status.syncing", "Syncing")
            : t("status.syncingCount", "Syncing {{count}}", { count: status.count });
        break;
      case "synced":
        label = t("status.synced", "Synced");
        break;
    }
  }
  const warning = error || status?.warning;
  let color = "fg.muted";
  if (status?.success) color = "fg.success";
  if (warning) color = "fg.warning";
  return (
    <HStack gap="xs" color={color}>
      <CloudStatusIcon status={status} active={data?.signingIn || status?.active} error={error} />
      <Text textStyle="paragraph/S/regular" whiteSpace="nowrap">
        {label}
      </Text>
    </HStack>
  );
};
