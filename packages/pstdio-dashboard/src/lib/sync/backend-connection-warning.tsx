import { Badge, Icon } from "@chakra-ui/react";
import { Tooltip } from "@pstdio/ui";
import { TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";

export const BackendConnectionWarning = () => {
  const { t } = useTranslation("common");

  return (
    <Tooltip content={t("connection.lost")} openDelay={300} closeDelay={150} positioning={{ placement: "top-end" }}>
      <Badge variant="plain" size="sm" color="fg.warning" tabIndex={0} role="status" aria-label={t("connection.lost")}>
        <Icon as={TriangleAlert} boxSize="3" aria-hidden="true" />
        {t("states.reconnecting")}
      </Badge>
    </Tooltip>
  );
};
