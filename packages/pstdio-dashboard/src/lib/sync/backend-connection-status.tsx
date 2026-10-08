import { Badge, Icon } from "@chakra-ui/react";
import { Tooltip } from "@pstdio/ui";
import { TriangleAlert, Wifi } from "lucide-react";
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
        variant="plain"
        size="sm"
        color={connected ? "fg.muted" : "fg.warning"}
        tabIndex={0}
        role="status"
        aria-label={description}
      >
        <Icon as={connected ? Wifi : TriangleAlert} boxSize="3" aria-hidden="true" />
        {t(connected ? "states.connected" : "states.reconnecting")}
      </Badge>
    </Tooltip>
  );
};
