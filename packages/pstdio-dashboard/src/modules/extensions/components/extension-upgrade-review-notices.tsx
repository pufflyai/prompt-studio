import { Box, Button, Collapsible, Stack, Text } from "@chakra-ui/react";
import { AlertMessage } from "@pstdio/ui";
import type { ExtensionUpgradeReview, ExtensionUpgradeReviewResolution } from "pstdio-api-contracts";
import { useTranslation } from "react-i18next";

export const ReviewSourceSummary = ({ review }: { review: ExtensionUpgradeReview }) => {
  const { t } = useTranslation("projects", { keyPrefix: "projectSettings.extensionsPanel.upgradeReview" });
  return (
    <>
      <Text>
        {t("summary", "Incoming version {{version}}. Your extension stays active until you apply.", {
          version: review.incomingVersion,
        })}
      </Text>
      {review.separateLocalProvider && (
        <AlertMessage status="info" title={t("localActive", "This project uses your local copy")}>
          {t(
            "separateProviderDescription",
            "Applying uses a separate provider for this project. Your local folder stays at {{path}}.",
            { path: review.localPath },
          )}
        </AlertMessage>
      )}
      {!review.hasOriginal && (
        <AlertMessage status="warning" title={t("unknownOriginal", "Original release unavailable")}>
          {t(
            "unknownOriginalDescription",
            "Choose how to handle each difference between your copy and the incoming release.",
          )}
        </AlertMessage>
      )}
    </>
  );
};

export const StaleReviewNotice = (props: { paths: string[]; busy: boolean; onRefresh: () => void }) => {
  const { paths, busy, onRefresh } = props;
  const { t } = useTranslation("projects", { keyPrefix: "projectSettings.extensionsPanel.upgradeReview" });
  return (
    <AlertMessage status="warning" title={t("sourceChanged", "The extension source changed during this review")}>
      <Text>{t("outdatedComparison", "Refresh to compare your latest files with the same release.")}</Text>
      {paths.length > 0 && (
        <Box as="ul" ps="lg" overflowWrap="anywhere">
          {paths.slice(0, 10).map((path) => (
            <li key={path}>{path}</li>
          ))}
        </Box>
      )}
      {paths.length > 10 && (
        <Text>{t("otherChangedPaths", "{{count}} more changed paths", { count: paths.length - 10 })}</Text>
      )}
      <Button size="sm" variant="outline" onClick={onRefresh} disabled={busy}>
        {t("refresh", "Refresh comparison")}
      </Button>
    </AlertMessage>
  );
};

export const PreviousReviewChoices = ({ choices }: { choices: ExtensionUpgradeReviewResolution[] }) => {
  const { t } = useTranslation("projects", { keyPrefix: "projectSettings.extensionsPanel.upgradeReview" });
  return (
    <Collapsible.Root>
      <Collapsible.Trigger asChild>
        <Button variant="ghost" size="sm">
          {t("previousChoices", "Previous choices")}
        </Button>
      </Collapsible.Trigger>
      <Collapsible.Content>
        <Stack gap="sm">
          <Text>{t("previousChoicesNotice", "These choices are available for reference after refreshing.")}</Text>
          {choices.map((choice) => (
            <Box key={choice.path} overflowWrap="anywhere">
              <Text fontWeight="semibold">{choice.path}</Text>
              {choice.kind === "text" && (
                <Box as="pre" fontFamily="mono" maxH="12rem" overflow="auto">
                  {choice.text}
                </Box>
              )}
              {choice.kind === "local" && <Text>{t("local", "Keep local")}</Text>}
              {choice.kind === "incoming" && <Text>{t("incoming", "Use incoming")}</Text>}
            </Box>
          ))}
        </Stack>
      </Collapsible.Content>
    </Collapsible.Root>
  );
};
