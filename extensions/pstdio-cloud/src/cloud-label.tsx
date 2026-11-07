import { HStack, Icon, Spinner, Text } from "@chakra-ui/react";
import { resolveIconComponent } from "@pstdio/ui";
import { useCloudContext } from "./cloud-context";
import { cloudStatus } from "./status";
import type { useCloud } from "./use-cloud";

export const CloudIcon = (props: { name: string }) => {
  const { name } = props;
  return <Icon as={resolveIconComponent(name)} boxSize="4" aria-hidden="true" />;
};

export const CloudLabel = (props: { data: ReturnType<typeof useCloud>["data"]; error?: string }) => {
  const { data, error } = props;
  const { t } = useCloudContext();
  const status = data ? cloudStatus(data.account, data.sync) : undefined;
  let label = t("status.loading", "Cloud");
  if (error) label = t("status.attention", "Needs attention");
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
        label = t("status.offline", "Offline");
        break;
      case "attention":
        label = t("status.attention", "Needs attention");
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
      {data?.signingIn || status?.active ? (
        <Spinner size="xs" />
      ) : (
        <CloudIcon name={error ? "triangle-alert" : (status?.icon ?? "cloud")} />
      )}
      <Text textStyle="paragraph/S/regular" whiteSpace="nowrap">
        {label}
      </Text>
    </HStack>
  );
};
