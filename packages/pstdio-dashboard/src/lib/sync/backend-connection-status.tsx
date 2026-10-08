import { Badge, Icon } from "@chakra-ui/react";
import { Tooltip } from "@pstdio/ui";
import { Circle } from "lucide-react";
import { useTranslation } from "react-i18next";

interface BackendConnectionStatusProps {
  connected: boolean;
}

export const BackendConnectionStatus = (props: BackendConnectionStatusProps) => {
  const { connected } = props;
  const { t } = useTranslation("common");
  const description = t(connected ? "connection.connected" : "connection.lost");

  return (
    <Tooltip content={description} openDelay={300} closeDelay={150} positioning={{ placement: "top-end" }}>
      <Badge
        variant="chip"
        size="sm"
        color={connected ? "fg.success" : "fg.error"}
        tabIndex={0}
        role="status"
        aria-label={description}
      >
        <Icon as={Circle} boxSize="status-dot" fill="currentColor" strokeWidth={0} aria-hidden="true" />
        {!connected && t("connection.unavailable")}
      </Badge>
    </Tooltip>
  );
};
