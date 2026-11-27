import { Checkbox, HStack, Stack, Text } from "@chakra-ui/react";
import type { AccountSignInProvider } from "@pstdio/sdk/extensions";
import { createWebviewClient } from "@pstdio/sdk/extensions";
import { SimpleCard, SimpleCardBody } from "@pstdio/ui";
import { useState } from "react";
import { AccountSignInActions, AccountSignInNotice } from "./account-sign-in-actions";
import { CloudContext } from "./cloud-context";
import { CloudIcon } from "./cloud-label";
import type { cloudCommands } from "./project-state";

const client = createWebviewClient<typeof cloudCommands>({
  extensionId: "pstdio.pstdio-cloud",
  call: async () => {
    throw new Error("Canvas has no Cloud service");
  },
  onEvent: () => () => {},
});

export default {
  title: "Cloud/Account sign-in",
  description: "One sign-in action opens a provider list with Google and Microsoft icons.",
};

export const AccountSignIn = () => {
  const [provider, setProvider] = useState<AccountSignInProvider>();
  const [failed, setFailed] = useState(false);
  const [disabled, setDisabled] = useState(false);
  return (
    <CloudContext value={{ client, t: (key, fallback = key) => fallback }}>
      <SimpleCard>
        <SimpleCardBody>
          <Stack gap="sm" position="relative">
            <Checkbox.Root checked={disabled} onCheckedChange={({ checked }) => setDisabled(checked === true)}>
              <Checkbox.HiddenInput />
              <Checkbox.Control />
              <Checkbox.Label>Disable sign-in</Checkbox.Label>
            </Checkbox.Root>
            <HStack gap="xs">
              <CloudIcon name="user-round" />
              <Text textStyle="label/M/medium">Account</Text>
            </HStack>
            <HStack justify="space-between" flexWrap="wrap">
              <Text>{provider ? "Waiting for sign-in…" : "Not signed in"}</Text>
              <AccountSignInActions
                pending={!!provider}
                disabled={disabled}
                signIn={(selected) => {
                  setFailed(false);
                  setProvider(selected);
                }}
                cancel={() => {
                  setProvider(undefined);
                  setFailed(true);
                }}
              />
            </HStack>
            <AccountSignInNotice attempt={failed ? { id: "cancelled", status: "failed" } : undefined} />
          </Stack>
        </SimpleCardBody>
      </SimpleCard>
    </CloudContext>
  );
};
