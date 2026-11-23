import { ButtonGroup, IconButton, Stack, Text } from "@chakra-ui/react";
import { CircleAlert, X } from "lucide-react";
import { ProgressButton } from "../../components/primitives/progress-button";

export default { title: "Proposals/PS-289/Unconfirmed extension install" };

export const InstallOutcomeUnconfirmed = () => (
  <Stack padding="lg" gap="md" align="flex-start">
    <Text textStyle="heading/M">Notes</Text>
    <ButtonGroup attached size="sm">
      <ProgressButton status="error" disabled>
        <CircleAlert />
        <Text as="span">
          Install outcome unconfirmed · Inspect Extensions or discard this attempt in System activity.
        </Text>
      </ProgressButton>
      <IconButton aria-label="Dismiss install message">
        <X />
      </IconButton>
    </ButtonGroup>
  </Stack>
);
