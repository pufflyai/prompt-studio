import { Button, HStack, Link, Stack, Text } from "@chakra-ui/react";
import { AlertMessage } from "@pstdio/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getApiClient } from "@/lib/api";
import { cloudAccountKey, cloudDevicesKey, cloudProjectKey, useCloudAccount } from "@/shared/cloud/use-cloud-account";
import { DeviceList } from "./device-list";

export const CloudAccountPanel = () => {
  const account = useCloudAccount();
  const client = useQueryClient();
  const [login, setLogin] = useState<{ id: string; url: string }>();
  const [notice, setNotice] = useState<string>();
  const [now, setNow] = useState(Date.now);
  const refresh = async () => {
    await Promise.all(
      [cloudAccountKey, cloudDevicesKey, cloudProjectKey].map((queryKey) => client.invalidateQueries({ queryKey })),
    );
  };
  const devices = useQuery({
    queryKey: [...cloudDevicesKey, account.data?.login?.accountId],
    queryFn: () => getApiClient().account.devices(),
    enabled: !!account.data?.login,
    refetchInterval: 10_000,
  });
  // A stalled refetch must not keep an old presence snapshot authoritative.
  const presenceExpiresAt = devices.dataUpdatedAt + 10_000;
  useEffect(() => {
    setNow(Date.now());
    const timer = setTimeout(() => setNow(Date.now()), Math.max(0, presenceExpiresAt - Date.now()));
    return () => clearTimeout(timer);
  }, [presenceExpiresAt]);
  const action = useMutation({
    mutationFn: (run: () => Promise<unknown>) => run(),
    onSuccess: refresh,
  });
  const signIn = useMutation({
    mutationFn: async () => {
      const popup = window.open("about:blank", "_blank");
      if (popup) popup.opener = null;
      try {
        const started = await getApiClient().account.login();
        setLogin(started);
        setNotice(undefined);
        popup?.location.replace(started.url);
      } catch (error) {
        popup?.close();
        throw error;
      }
    },
  });
  useEffect(() => {
    if (!login) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const result = await getApiClient().account.loginStatus(login.id);
        if (!active) return;
        if (result.status !== "pending") {
          setLogin(undefined);
          setNotice(
            result.status === "complete"
              ? "Signed in. Your local work stays here."
              : "Sign-in did not finish. Your local work stays here. Try again when you are ready.",
          );
          await Promise.all(
            [cloudAccountKey, cloudDevicesKey, cloudProjectKey].map((queryKey) =>
              client.invalidateQueries({ queryKey }),
            ),
          );
          return;
        }
      } catch {
        if (active) setNotice("Could not check sign-in. Keep this page open or cancel and try again.");
      }
      if (active)
        timer = setTimeout(() => {
          void poll();
        }, 1_000);
    };
    void poll();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [login, client]);
  const error = signIn.error ?? action.error ?? account.error ?? devices.error;
  return (
    <Stack gap="md" padding="lg">
      <Text textStyle="heading/S">Account and devices</Text>
      {notice && (
        <Text role="status" textStyle="paragraph/S/regular">
          {notice}
        </Text>
      )}
      {error && (
        <AlertMessage
          status="error"
          title="Cloud request could not finish"
          endElement={
            <Button
              onClick={() => {
                signIn.reset();
                action.reset();
                void refresh();
              }}
            >
              Try again
            </Button>
          }
        >
          {error.message}
        </AlertMessage>
      )}
      {account.isPending && <Text color="fg.muted">Loading account…</Text>}
      {!account.isPending && account.data?.login && (
        <>
          <Text textStyle="paragraph/S/regular">
            Signed in · {account.data.login.email ?? account.data.login.accountId}
          </Text>
          <Button
            size="sm"
            variant="outline"
            alignSelf="start"
            loading={action.isPending}
            onClick={() =>
              action.mutate(async () => {
                const result = await getApiClient().account.logout();
                client.removeQueries({ queryKey: cloudDevicesKey });
                setNotice(
                  result.removed
                    ? "Signed out. Your local work stays here."
                    : "Signed out locally. Remove this device from another device when Cloud is available.",
                );
              })
            }
          >
            Sign out
          </Button>
          {devices.isPending ? (
            <Text color="fg.muted">Loading devices…</Text>
          ) : (
            <DeviceList
              devices={devices.data ?? []}
              busy={action.isPending}
              presenceAvailable={!devices.isError && now < presenceExpiresAt}
              onRename={(id, name) => action.mutate(() => getApiClient().account.renameDevice(id, name))}
              onRemove={(id) => action.mutate(() => getApiClient().account.removeDevice(id))}
            />
          )}
        </>
      )}
      {!account.isPending && !account.data?.login && (
        <>
          <Text textStyle="paragraph/S/regular" color="fg.muted">
            Sign in once to connect this device to your Cloud projects. Local projects stay independent.
          </Text>
          {login ? (
            <Stack gap="sm">
              <Text role="status">Finish Google sign-in in the browser.</Text>
              <Link href={login.url} target="_blank" rel="noreferrer">
                Open Google sign-in
              </Link>
              <Button
                size="sm"
                variant="outline"
                alignSelf="start"
                loading={action.isPending}
                onClick={() =>
                  action.mutate(async () => {
                    const result = await getApiClient().account.cancelLogin(login.id);
                    setLogin(undefined);
                    setNotice(
                      result.status === "complete"
                        ? "Sign-in already completed. Your local work stays here."
                        : "Sign-in cancelled. Your local work stays here.",
                    );
                  })
                }
              >
                Cancel sign-in
              </Button>
            </Stack>
          ) : (
            <HStack>
              <Button
                size="sm"
                variant="primary"
                loading={signIn.isPending}
                disabled={!account.data?.signInAvailable}
                onClick={() => signIn.mutate()}
              >
                Continue with Google
              </Button>
            </HStack>
          )}
          {account.data?.signInAvailable === false && (
            <Text color="fg.muted" textStyle="paragraph/S/regular">
              Cloud sign-in is not available on this runtime yet.
            </Text>
          )}
        </>
      )}
    </Stack>
  );
};
