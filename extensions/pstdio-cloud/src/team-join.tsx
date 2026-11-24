import { HStack, Input, Stack, Text } from "@chakra-ui/react";
import type { DeviceLogin, TeamInvitationView } from "@pstdio/sdk/extensions";
import { useState } from "react";
import { Button } from "./button";
import { useCloudContext } from "./cloud-context";
import { CloudError } from "./cloud-error";

export const TeamJoin = (props: { login: DeviceLogin; close: () => void; joined: (accountId?: string) => void }) => {
  const { client, t } = useCloudContext();
  const [url, setUrl] = useState("");
  const [view, setView] = useState<TeamInvitationView>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const expected = { accountId: props.login.accountId, managerOrigin: props.login.managerOrigin };
  const inspect = () => client.account.readTeamMembership({ op: "inspectInvitation", url: url.trim() }, expected);

  const run = async (accept = false) => {
    setBusy(true);
    setError(undefined);
    try {
      if (accept) {
        const joined = await client.account
          .writeTeamMembership({ op: "acceptInvitation", url: url.trim() }, expected)
          .catch(async (cause: unknown) => {
            // The authority could have committed the join before the native response was lost.
            const current = await inspect();
            setView(current);
            if (current.state === "joined") return undefined;
            throw cause;
          });
        props.joined(joined?.accountId);
      } else {
        setView(await inspect());
      }
    } catch (cause) {
      setError(String(cause));
    } finally {
      setBusy(false);
    }
  };

  const states = {
    pending: t("members.separateProjects", "Joining the team does not grant access to projects."),
    joined: t("join.joined", "You already joined this team."),
    consumed: t("join.consumed", "This invitation has already been used."),
    canceled: t("join.canceled", "This invitation was canceled."),
    expired: t("join.expired", "This invitation expired."),
    "wrong-identity": t("join.wrongIdentity", "Sign in with the Google account that received this invitation."),
    unknown: t("join.unknown", "This invitation is unavailable."),
  };
  return (
    <Stack gap="xs">
      <HStack
        as="form"
        onSubmit={(event) => {
          event.preventDefault();
          if (url.trim()) void run();
        }}
      >
        <Input
          size="sm"
          type="url"
          required
          value={url}
          maxLength={2048}
          disabled={busy}
          aria-label={t("join.link", "Team invitation link")}
          onChange={(event) => {
            setUrl(event.target.value);
            setView(undefined);
            setError(undefined);
          }}
        />
        <Button size="sm" variant="outline" type="submit" disabled={busy || !url.trim()}>
          {t("join.inspect", "Check link")}
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={props.close}>
          {t("teams.cancel", "Cancel")}
        </Button>
      </HStack>
      {view && (
        <Stack gap="xs">
          {view.teamName && <Text textStyle="label/M/medium">{view.teamName}</Text>}
          {view.signedInEmail && (
            <Text>{t("join.identity", "Signed in as {{email}}", { email: view.signedInEmail })}</Text>
          )}
          <Text role="status">{states[view.state]}</Text>
          {view.state === "pending" && (
            <Button size="sm" variant="primary" alignSelf="flex-start" disabled={busy} onClick={() => void run(true)}>
              {t("join.accept", "Join team")}
            </Button>
          )}
        </Stack>
      )}
      {error && <CloudError message={error} onClose={() => setError(undefined)} />}
    </Stack>
  );
};
