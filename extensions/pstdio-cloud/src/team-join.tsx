import { HStack, Input, Stack, Text } from "@chakra-ui/react";
import type { DeviceLogin, TeamInvitationView } from "@pstdio/sdk/extensions";
import { useState } from "react";
import { Button } from "./button";
import { useCloudContext } from "./cloud-context";
import { CloudError } from "./cloud-error";

interface TeamJoinProps {
  login: DeviceLogin;
  close: () => void;
  joined: (accountId?: string) => void;
}

export const TeamJoin = (props: TeamJoinProps) => {
  const { login, close, joined } = props;
  const { client, t } = useCloudContext();
  const expected = { accountId: login.accountId, managerOrigin: login.managerOrigin };
  const [code, setCode] = useState("");
  const [inspection, setInspection] = useState<{ code: string; view: TeamInvitationView }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const view = inspection?.code === code.trim() ? inspection.view : undefined;
  const inspect = (code: string) => client.account.readTeamMembership({ op: "inspectInviteCode", code }, expected);
  const run = async (accept = false) => {
    if (busy || (accept && view?.state !== "pending")) return;
    const submitted = code.trim();
    setBusy(true);
    setError(undefined);
    try {
      if (!accept) {
        const current = await inspect(submitted);
        setInspection({ code: submitted, view: current });
        if (current.state === "joined") joined();
        return;
      }
      const result = await client.account
        .writeTeamMembership({ op: "acceptInviteCode", code: submitted }, expected)
        .catch(async (cause: unknown) => {
          const current = await inspect(submitted);
          setInspection({ code: submitted, view: current });
          if (current.state === "joined") return undefined;
          throw cause;
        });
      joined(result?.accountId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
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
    "wrong-identity": t("join.unavailable", "This invitation is unavailable for this account."),
    unknown: t("join.unknown", "This invitation is unavailable."),
  };
  return (
    <Stack gap="md" position="relative">
      <Stack
        as="form"
        gap="sm"
        onSubmit={(event) => {
          event.preventDefault();
          if (code.trim()) void run();
        }}
      >
        <Input
          aria-label={t("join.code", "Invite code")}
          value={code}
          autoComplete="off"
          autoFocus
          maxLength={128}
          onChange={(event) => {
            setCode(event.target.value);
            setInspection(undefined);
            setError(undefined);
          }}
        />
        <HStack justify="end">
          <Button size="sm" variant="ghost" onClick={close}>
            {t("teams.cancel", "Cancel")}
          </Button>
          <Button
            size="sm"
            variant="primary"
            type="submit"
            loading={busy}
            disabled={busy || !/^[A-Za-z0-9_-]{43}$/.test(code.trim())}
          >
            {t("join.inspectCode", "Check code")}
          </Button>
        </HStack>
      </Stack>
      {view && (
        <Stack gap="sm">
          {view.teamName && <Text textStyle="label/M/medium">{view.teamName}</Text>}
          <Text>
            {t("join.identity", "Signed in as {{identity}}", {
              identity: view.signedInEmail ?? login.email ?? login.accountId,
            })}
          </Text>
          <Text role="status" color="fg.muted">
            {states[view.state]}
          </Text>
          {view.state === "pending" && (
            <Button
              size="sm"
              variant="primary"
              alignSelf="start"
              loading={busy}
              disabled={busy}
              onClick={() => void run(true)}
            >
              {t("join.accept", "Join team")}
            </Button>
          )}
        </Stack>
      )}
      {error && <CloudError inline message={error} onClose={() => setError(undefined)} />}
    </Stack>
  );
};
