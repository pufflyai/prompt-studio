import { Button, Stack, Text } from "@chakra-ui/react";
import type { AutoBuildButtonProps } from "./auto-build-button";

interface AutoBuildRequestsProps
  extends Pick<AutoBuildButtonProps, "reviewRequests" | "requestErrors" | "onOpenRequest" | "t"> {}

export function AutoBuildRequests(props: AutoBuildRequestsProps) {
  const { reviewRequests = [], requestErrors = [], onOpenRequest, t } = props;
  if (!reviewRequests.length && !requestErrors.length) return null;
  return (
    <Stack gap="sm">
      <Text textStyle="label/2XS/medium" color="fg.muted" textTransform="uppercase">
        {t("timeline.autoBuild.requests", "Needs attention")}
      </Text>
      {requestErrors.map((error) => (
        <Text key={error} role="alert" color="fg.error">
          {error}
        </Text>
      ))}
      {reviewRequests.map((request) => (
        <Stack key={request.id} gap="xs" p="sm" bg="bg.subtle" borderRadius="md">
          <Text textStyle="label/S/medium">{request.title}</Text>
          <Text textStyle="paragraph/S/regular" lineClamp={3}>
            {request.instructions}
          </Text>
          <Button alignSelf="start" size="sm" variant="ghost" onClick={() => onOpenRequest?.(request)}>
            {t("timeline.autoBuild.openRequest", "Open request")}
          </Button>
        </Stack>
      ))}
    </Stack>
  );
}
