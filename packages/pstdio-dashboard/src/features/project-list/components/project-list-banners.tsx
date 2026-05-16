import { Button, Stack, Text } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";

interface ProjectListBannersProps {
  showNoAgentsBanner: boolean;
  showAgentErrorBanner: boolean;
  onRetryAgents: () => void;
}

export const ProjectListBanners = (props: ProjectListBannersProps) => {
  const { showNoAgentsBanner, showAgentErrorBanner, onRetryAgents } = props;
  const { t } = useTranslation("projects");

  if (!showNoAgentsBanner && !showAgentErrorBanner) return null;

  return (
    <Stack gap="sm">
      {showNoAgentsBanner ? (
        <Stack borderWidth="1px" borderColor="orange.300" bg="orange.50" borderRadius="md" p="sm" gap="2xs">
          <Text textStyle="label/M/medium" color="orange.900">
            {t("list.noAgentsBanner.title")}
          </Text>
          <Text textStyle="paragraph/S/regular" color="orange.800">
            {t("list.noAgentsBanner.description")}
          </Text>
        </Stack>
      ) : null}

      {showAgentErrorBanner ? (
        <Stack borderWidth="1px" borderColor="red.300" bg="red.50" borderRadius="md" p="sm" gap="xs">
          <Stack gap="2xs">
            <Text textStyle="label/M/medium" color="red.900">
              {t("list.agentLoadErrorBanner.title")}
            </Text>
            <Text textStyle="paragraph/S/regular" color="red.800">
              {t("list.agentLoadErrorBanner.description")}
            </Text>
          </Stack>
          <Stack direction="row" justifyContent="flex-end">
            <Button size="xs" variant="outline" onClick={onRetryAgents}>
              {t("list.agentLoadErrorBanner.retry")}
            </Button>
          </Stack>
        </Stack>
      ) : null}
    </Stack>
  );
};
