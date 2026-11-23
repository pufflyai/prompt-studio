import { Button, Stack, Text } from "@chakra-ui/react";
import { AlertMessage } from "../../components/primitives/alert";

export default { title: "Proposals/PS-289/Unconfirmed token issuance" };

export const IssueOutcomeUnconfirmed = () => (
  <Stack gap="sm" padding="lg" align="flex-start">
    <Text textStyle="label/L/medium">Issue machine token</Text>
    <AlertMessage compact status="warning" title="Token issuance could not be confirmed.">
      Review active tokens. The request is available in System activity.
    </AlertMessage>
    <Button size="sm" disabled>
      Issue token
    </Button>
  </Stack>
);
