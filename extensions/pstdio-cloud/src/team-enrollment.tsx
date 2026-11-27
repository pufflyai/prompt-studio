import { CloseButton, HStack, Input, Stack } from "@chakra-ui/react";
import type { DeviceLogin, TeamAccount } from "@pstdio/sdk/extensions";
import { ScopedDialog as Dialog, Portal } from "@pstdio/ui";
import { useState } from "react";
import { Button } from "./button";
import { useCloudContext } from "./cloud-context";
import { CloudError } from "./cloud-error";
import { TeamJoin } from "./team-join";

interface TeamEnrollmentProps {
  mode: "create" | "join";
  login: DeviceLogin;
  created: (team: TeamAccount) => void;
  joined: (accountId?: string) => void;
  close: () => void;
}

export const TeamEnrollment = (props: TeamEnrollmentProps) => {
  const { mode, login, created, joined, close } = props;
  const { client, t } = useCloudContext();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  return (
    <Dialog.Root open onOpenChange={({ open }) => !open && close()} size="sm" placement="center">
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>
                {mode === "create" ? t("teams.create", "Create team") : t("join.accept", "Join team")}
              </Dialog.Title>
              <Dialog.CloseTrigger asChild>
                <CloseButton size="sm" />
              </Dialog.CloseTrigger>
            </Dialog.Header>
            <Dialog.Body>
              {mode === "join" ? (
                <TeamJoin login={login} close={close} joined={joined} />
              ) : (
                <Stack
                  gap="sm"
                  as="form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (busy || !name.trim()) return;
                    setBusy(true);
                    setError(undefined);
                    void client.account
                      .createTeam(name.trim(), { accountId: login.accountId, managerOrigin: login.managerOrigin })
                      .then(created)
                      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : String(cause)))
                      .finally(() => setBusy(false));
                  }}
                >
                  <Input
                    aria-label={t("teams.name", "Team name")}
                    value={name}
                    maxLength={100}
                    autoFocus
                    onChange={(event) => setName(event.target.value)}
                  />
                  {error && <CloudError inline message={error} onClose={() => setError(undefined)} />}
                  <HStack justify="end">
                    <Button variant="ghost" onClick={close}>
                      {t("teams.cancel", "Cancel")}
                    </Button>
                    <Button variant="primary" type="submit" loading={busy} disabled={busy || !name.trim()}>
                      {t("teams.save", "Create")}
                    </Button>
                  </HStack>
                </Stack>
              )}
            </Dialog.Body>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
};
