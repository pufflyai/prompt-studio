import { Button } from "@chakra-ui/react";
import { MessageCircleWarning } from "lucide-react";

interface AutoBuildRequestsProps {
  onOpen: () => void;
  t: (key: string, fallback?: string) => string;
}

export function AutoBuildRequests(props: AutoBuildRequestsProps) {
  const { onOpen, t } = props;
  return (
    <Button size="sm" variant="outline" onClick={onOpen}>
      <MessageCircleWarning />
      {t("timeline.autoBuild.requests", "Needs attention")}
    </Button>
  );
}
