import { Box } from "@chakra-ui/react";
import { Tooltip } from "@pstdio/ui";
import { useTranslation } from "react-i18next";

export type BackendConnectionStatus = "connecting" | "connected" | "error";

type BackendConnectionEvent = "connected" | "disconnected";

type BackendConnectionDotState = {
  color: "gray.500" | "green.500" | "red.500";
  labelKey: string;
};

type BackendConnectionDotProps = {
  status: BackendConnectionStatus;
};

export const getNextBackendConnectionStatus = (
  currentStatus: BackendConnectionStatus,
  event: BackendConnectionEvent,
) => {
  if (event === "connected") {
    return "connected";
  }

  if (currentStatus === "connected" || currentStatus === "connecting") {
    return "error";
  }

  return currentStatus;
};

export const getBackendConnectionDotState = (status: BackendConnectionStatus): BackendConnectionDotState => {
  if (status === "connecting") {
    return { color: "gray.500", labelKey: "shell.backendConnecting" };
  }

  if (status === "connected") {
    return { color: "green.500", labelKey: "shell.backendConnected" };
  }

  return { color: "red.500", labelKey: "shell.backendDisconnected" };
};

export const BackendConnectionDot = (props: BackendConnectionDotProps) => {
  const { status } = props;
  const { t } = useTranslation("projects");
  const dotState = getBackendConnectionDotState(status);
  const label = t(dotState.labelKey);

  return (
    <Box position="fixed" top="3" right="3" zIndex="docked">
      <Tooltip content={label} positioning={{ placement: "left" }}>
        <Box
          as="span"
          display="inline-block"
          boxSize="2.5"
          borderRadius="full"
          bg={dotState.color}
          aria-label={label}
        />
      </Tooltip>
    </Box>
  );
};
