import { HStack, Input, Stack, Text } from "@chakra-ui/react";
import type { AccountDevice } from "@pstdio/sdk/extensions";
import { AlertMessage, DeleteConfirmationModal, ScrollArea, SimpleCard, SimpleCardBody } from "@pstdio/ui";
import { type ReactNode, useState } from "react";
import { Button } from "./button";
import { useCloudContext } from "./cloud-context";
import { CloudIcon, CloudLabel } from "./cloud-label";
import { useCloud } from "./use-cloud";

const SectionTitle = (props: { icon: string; children: ReactNode }) => {
  const { icon, children } = props;
  return (
    <HStack gap="xs">
      <CloudIcon name={icon} />
      <Text textStyle="label/M/medium">{children}</Text>
    </HStack>
  );
};

interface ActionError {
  section: string;
  message: string;
}
const ActionFailure = (props: { section: string; error?: ActionError }) => {
  const { section, error } = props;
  return error?.section === section ? <AlertMessage status="error">{error.message}</AlertMessage> : null;
};

const DeviceRow = (props: { device: AccountDevice; onChange: () => void }) => {
  const { device, onChange } = props;
  const { client, t } = useCloudContext();
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(device.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  let presence = t("devices.offline", "Offline");
  if (device.online) presence = t("devices.online", "Online");
  if (device.current) presence = t("devices.current", "This device");
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(undefined);
    try {
      await action();
      onChange();
    } catch (cause) {
      setError(String(cause));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Stack gap="xs">
      <HStack gap="sm" justify="space-between">
        <CloudIcon name={device.current ? "laptop" : "monitor"} />
        <Stack gap="2xs" flex="1" minW="0">
          {renaming ? (
            <Input
              size="sm"
              aria-label={t("devices.name", "Device name")}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
          ) : (
            <Text>{device.name}</Text>
          )}
          <Text textStyle="label/S/regular" color="fg.muted">
            {presence}
          </Text>
        </Stack>
        <Button
          size="sm"
          variant="ghost"
          disabled={busy || (renaming && !draft.trim())}
          onClick={() => {
            if (!renaming) {
              setDraft(device.name);
              setRenaming(true);
              return;
            }
            void run(async () => {
              await client.account.renameDevice(device.id, draft.trim());
              setRenaming(false);
            });
          }}
        >
          <CloudIcon name={renaming ? "check" : "pencil"} />
          {renaming ? t("devices.save", "Save") : t("devices.rename", "Rename")}
        </Button>
        <Button
          size="sm"
          variant="destructive-ghost"
          loading={busy}
          disabled={busy}
          onClick={() => void run(() => client.account.removeDevice(device.id))}
        >
          <CloudIcon name="trash-2" />
          {t("devices.remove", "Remove")}
        </Button>
      </HStack>
      {error && <AlertMessage status="error">{error}</AlertMessage>}
    </Stack>
  );
};

export const CloudSettings = (props: { projectId?: string }) => {
  const { projectId } = props;
  const { client, t } = useCloudContext();
  const { data, error, refresh } = useCloud(projectId, true);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState<string>();
  const [actionError, setActionError] = useState<ActionError>();
  const run = async (section: string, action: () => Promise<unknown>) => {
    setBusy(section);
    setActionError(undefined);
    try {
      await action();
      refresh();
    } catch (cause) {
      setActionError({ section, message: String(cause) });
    } finally {
      setBusy(undefined);
    }
  };
  const signIn = async () => {
    const login = await client.account.login();
    try {
      await client.navigation.open({ kind: "href", href: login.url });
    } catch (cause) {
      await client.account.cancelLogin(login.id);
      throw cause;
    }
  };
  const cancelSignIn = async () => {
    const id = data?.account.loginAttempt?.id;
    if (id) await client.account.cancelLogin(id);
  };
  const account = data?.account;
  const local = data?.sync.state === "local";
  const earlyAccess = account?.features?.relay;
  const signingOut = account?.login && !account.signInRequired;
  let accountAction = t("status.signIn", "Sign in");
  if (account?.signInRequired) accountAction = t("status.signInAgain", "Sign in again");
  if (signingOut) accountAction = t("account.signOut", "Sign out");
  let accessLabel = t("access.comingSoon", "Coming soon");
  if (earlyAccess) accessLabel = t("access.enabled", "Early access enabled");
  if (account?.features === null) accessLabel = t("access.loading", "Checking Cloud access…");
  return (
    <Stack h="full" minH="0" gap="0">
      <ScrollArea flex="1" minH="0">
        <Stack gap="md" px="lg" pb="lg" maxW="3xl" w="full" mx="auto">
          {error && (
            <AlertMessage
              status="error"
              endElement={
                <Button size="sm" onClick={refresh}>
                  {t("actions.retry", "Retry")}
                </Button>
              }
            >
              {error}
            </AlertMessage>
          )}
          <SimpleCard>
            <SimpleCardBody>
              <Stack gap="sm">
                <SectionTitle icon="user-round">{t("account.title", "Account")}</SectionTitle>
                <HStack justify="space-between">
                  <Stack gap="2xs">
                    <Text>
                      {account?.login?.email ??
                        (account?.login ? t("status.signedIn", "Signed in") : t("account.signedOut", "Not signed in"))}
                    </Text>
                    {data?.signingIn && <CloudLabel data={data} />}
                  </Stack>
                  {data?.signingIn ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!!busy}
                      onClick={() => void run("account", cancelSignIn)}
                    >
                      {t("account.cancelLogin", "Cancel sign-in")}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      loading={busy === "account"}
                      disabled={!data || !!busy}
                      onClick={() =>
                        void run(
                          "account",
                          signingOut
                            ? async () => {
                                await client.account.logout();
                              }
                            : signIn,
                        )
                      }
                    >
                      <CloudIcon name={signingOut ? "log-out" : "log-in"} />
                      {accountAction}
                    </Button>
                  )}
                </HStack>
                {data?.loginFailed && !account?.login && (
                  <AlertMessage status="error">
                    {t("account.loginFailed", "Sign-in did not complete. Sign in to try again.")}
                  </AlertMessage>
                )}
                <ActionFailure section="account" error={actionError} />
              </Stack>
            </SimpleCardBody>
          </SimpleCard>
          {account?.login && (
            <SimpleCard>
              <SimpleCardBody>
                <Stack gap="sm">
                  <SectionTitle icon="shield-check">{t("access.title", "Cloud access")}</SectionTitle>
                  <HStack gap="xs" color="fg.muted">
                    <CloudIcon name={earlyAccess ? "circle-check" : "cloud"} />
                    <Text>{accessLabel}</Text>
                  </HStack>
                </Stack>
              </SimpleCardBody>
            </SimpleCard>
          )}
          {earlyAccess && account?.login && data && (
            <>
              <SimpleCard>
                <SimpleCardBody>
                  <Stack gap="md">
                    <SectionTitle icon="monitor">{t("devices.yours", "Your devices")}</SectionTitle>
                    {data.devices.map((device) => (
                      <DeviceRow key={device.id} device={device} onChange={refresh} />
                    ))}
                  </Stack>
                </SimpleCardBody>
              </SimpleCard>
              {projectId && (
                <>
                  <SimpleCard>
                    <SimpleCardBody>
                      <Stack gap="sm">
                        <HStack justify="space-between">
                          <SectionTitle icon="folder">{t("project.title", "This project")}</SectionTitle>
                          <CloudLabel data={data} />
                        </HStack>
                        {local && (
                          <>
                            <Text textStyle="paragraph/S/regular" color="fg.muted">
                              {t(
                                "project.merge",
                                "Syncing again merges the copies. Where both copies changed the same thing, one change is kept.",
                              )}
                            </Text>
                            <Button
                              size="sm"
                              variant="primary"
                              alignSelf="flex-start"
                              loading={busy === "project"}
                              disabled={!!busy}
                              onClick={() => void run("project", () => client.account.syncProject(projectId))}
                            >
                              <CloudIcon name="cloud-upload" />
                              {t("project.sync", "Sync with Cloud")}
                            </Button>
                          </>
                        )}
                        <ActionFailure section="project" error={actionError} />
                      </Stack>
                    </SimpleCardBody>
                  </SimpleCard>
                  {!local && (
                    <AlertMessage
                      status="warning"
                      title={t("project.makeLocal", "Make this project local")}
                      endElement={
                        <Button size="2xs" variant="ghost" disabled={!!busy} onClick={() => setConfirming(true)}>
                          <CloudIcon name="cloud-off" />
                          {t("project.makeLocalButton", "Make local")}
                        </Button>
                      }
                    >
                      {t("project.localEffect", "Syncing stops on all devices. Each device keeps its copy.")}
                    </AlertMessage>
                  )}
                </>
              )}
            </>
          )}
        </Stack>
      </ScrollArea>
      <DeleteConfirmationModal
        open={confirming}
        onClose={() => setConfirming(false)}
        headline={t("project.confirmLocal", "Make this project local?")}
        buttonText={t("project.makeLocalButton", "Make local")}
        notificationText={t(
          "project.confirmEffect",
          "Syncing stops on all devices. Each device keeps its copy. Syncing again merges the copies; where both copies changed the same thing, one change is kept.",
        )}
        onDelete={async () => {
          if (!projectId) return;
          setActionError(undefined);
          try {
            await client.account.stopProjectSync(projectId);
            refresh();
          } catch (cause) {
            setActionError({ section: "confirmation", message: String(cause) });
            throw cause;
          }
        }}
      >
        <ActionFailure section="confirmation" error={actionError} />
      </DeleteConfirmationModal>
    </Stack>
  );
};
