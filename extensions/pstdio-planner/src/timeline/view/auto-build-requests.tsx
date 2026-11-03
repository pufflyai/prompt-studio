import { Button } from "@chakra-ui/react";
import { getIconComponent } from "@pstdio/ui";
import { REVIEW_REQUEST_ICON } from "../../data/review-request-summary";

interface AutoBuildRequestsProps {
  onOpen: () => void;
  t: (key: string, fallback?: string) => string;
}

export function AutoBuildRequests(props: AutoBuildRequestsProps) {
  const { onOpen, t } = props;
  const AttentionIcon = getIconComponent(REVIEW_REQUEST_ICON);
  return (
    <Button size="sm" variant="outline" onClick={onOpen}>
      <AttentionIcon />
      {t("timeline.autoBuild.requests", "Needs attention")}
    </Button>
  );
}
