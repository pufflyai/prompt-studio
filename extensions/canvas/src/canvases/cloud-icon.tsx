import { Icon } from "@chakra-ui/react";
import { resolveIconComponent } from "@pstdio/ui";

export type CloudIconName =
  | "cloud"
  | "cloud-off"
  | "cloud-upload"
  | "circle-check"
  | "laptop"
  | "monitor"
  | "log-in"
  | "log-out"
  | "user-round"
  | "folder"
  | "pencil"
  | "check"
  | "trash-2"
  | "settings"
  | "shield-check"
  | "wifi-off"
  | "triangle-alert";

export const CloudIcon = (props: { name: CloudIconName }) => (
  <Icon as={resolveIconComponent(props.name)} boxSize="4" aria-hidden="true" />
);
