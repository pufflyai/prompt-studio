import { HStack, Stack, Text } from "@chakra-ui/react";
import { type AccountStatus, commandRef } from "@pstdio/sdk/extensions";
import { SimpleCard, SimpleCardBody } from "@pstdio/ui";
import { useState } from "react";
import { Button } from "./button";
import { useCloudContext } from "./cloud-context";
import { CloudError } from "./cloud-error";
import { CloudIcon } from "./cloud-label";
import { TeamPicker } from "./team-picker";

const createProject = commandRef<{ teamAccountId: string }, void>({
  extensionId: "pstdio",
  id: "dashboard.createProject",
});

export const TeamAccounts = (props: { account: AccountStatus }) => {
  const { account } = props;
  const { client, t } = useCloudContext();
  const [selected, select] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const team = account.teamAccounts?.find(({ accountId }) => accountId === selected);
  const enabled = selected ? team?.features.relay : account.features?.relay;
  let access = t("access.comingSoon", "Coming soon");
  if (account.features === null) access = t("access.loading", "Checking Cloud access…");
  if (enabled) access = t("access.enabled", "Early access enabled");
  return (
    <SimpleCard>
      <SimpleCardBody>
        <Stack gap="sm" position="relative">
          <HStack gap="xs">
            <CloudIcon name="shield-check" />
            <Text textStyle="label/M/medium">{t("access.title", "Cloud access")}</Text>
          </HStack>
          <TeamPicker teams={account.teamAccounts ?? []} selected={selected} onSelect={select} personal />
          <Text color="fg.muted">{access}</Text>
          {team?.role === "owner" && enabled && (
            <Button
              size="sm"
              variant="outline"
              alignSelf="start"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                setError(undefined);
                void client.navigation
                  .open({
                    kind: "command",
                    target: { command: createProject, params: { teamAccountId: team.accountId } },
                  })
                  .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : String(cause)))
                  .finally(() => setBusy(false));
              }}
            >
              {t("teams.createProject", "Create project")}
            </Button>
          )}
          {error && <CloudError inline message={error} onClose={() => setError(undefined)} />}
        </Stack>
      </SimpleCardBody>
    </SimpleCard>
  );
};
