import { HStack, Input, Stack, Text } from "@chakra-ui/react";
import { type AccountStatus, commandRef } from "@pstdio/sdk/extensions";
import { SimpleCard, SimpleCardBody } from "@pstdio/ui";
import { useState } from "react";
import { Button } from "./button";
import { useCloudContext } from "./cloud-context";
import { CloudError } from "./cloud-error";
import { CloudIcon } from "./cloud-label";
import { TeamJoin } from "./team-join";
import { TeamMembers } from "./team-members";
import { TeamProjectSharing } from "./team-project-sharing";

const createProject = commandRef<{ teamAccountId: string }, void>({
  extensionId: "pstdio",
  id: "dashboard.createProject",
});

type Team = NonNullable<AccountStatus["teamAccounts"]>[number];
type Login = NonNullable<AccountStatus["login"]>;

const ActiveTeam = (props: { team: Team; account: AccountStatus; login: Login; refresh: () => void }) => {
  const { team, account, login, refresh } = props;
  const { client, t } = useCloudContext();
  const [members, showMembers] = useState(false);
  const [sharing, showSharing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const openProject = async () => {
    setBusy(true);
    setError(undefined);
    try {
      await client.navigation.open({
        kind: "command",
        target: { command: createProject, params: { teamAccountId: team.accountId } },
      });
    } catch (cause) {
      setError(String(cause));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Stack gap="xs">
      {team.role === "member" && !Object.values(account.teamProjects ?? {}).includes(team.accountId) && (
        <Text color="fg.muted">{t("teams.noneShared", "No projects shared with you")}</Text>
      )}
      <Button
        size="sm"
        variant="outline"
        alignSelf="flex-start"
        aria-expanded={members}
        onClick={() => showMembers(!members)}
      >
        {t("members.title", "Team members")}
      </Button>
      {members && (
        <TeamMembers key={JSON.stringify([team.accountId, team.role])} team={team} login={login} refresh={refresh} />
      )}
      {team.role === "owner" && (
        <Button
          size="sm"
          variant="outline"
          alignSelf="flex-start"
          aria-expanded={sharing}
          onClick={() => showSharing(!sharing)}
        >
          {t("sharing.title", "Project access")}
        </Button>
      )}
      {team.role === "owner" && sharing && (
        <TeamProjectSharing accountId={team.accountId} login={login} refresh={refresh} />
      )}
      {team.role === "owner" && team.features.relay && (
        <Button size="sm" variant="outline" alignSelf="flex-start" disabled={busy} onClick={() => void openProject()}>
          {t("teams.createProject", "Create project")}
        </Button>
      )}
      {error && <CloudError message={error} onClose={() => setError(undefined)} />}
    </Stack>
  );
};

export const TeamAccounts = (props: {
  account: AccountStatus;
  login: NonNullable<AccountStatus["login"]>;
  refresh: () => void;
}) => {
  const { account, login, refresh } = props;
  const { client, t } = useCloudContext();
  const [selected, select] = useState<string>();
  const [join, showJoin] = useState(false);
  const [created, setCreated] = useState<Team>();
  const [draft, setDraft] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const listed = account.teamAccounts ?? [];
  const confirmed = created && listed.some((team) => team.accountId === created.accountId);
  if (confirmed) setCreated(undefined);
  const teams = created && !confirmed ? [...listed, created] : listed;
  const active = teams.find((team) => team.accountId === selected);
  const features = selected ? active?.features : account.features;
  let access = t("access.comingSoon", "Coming soon");
  if (features?.relay) access = t("access.enabled", "Early access enabled");
  if (features === null) access = t("access.loading", "Checking Cloud access…");
  if (selected && !active) access = t("teams.unavailable", "Team unavailable");
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(undefined);
    try {
      await action();
    } catch (cause) {
      setError(String(cause));
    } finally {
      setBusy(false);
    }
  };
  const submit = () => {
    if (!draft?.trim()) return;
    void run(async () => {
      const team = await client.account.createTeam(draft.trim(), {
        accountId: login.accountId,
        managerOrigin: login.managerOrigin,
      });
      setCreated(team);
      select(team.accountId);
      setDraft(undefined);
      refresh();
    });
  };
  return (
    <SimpleCard>
      <SimpleCardBody>
        <Stack gap="sm" position="relative">
          <HStack gap="xs">
            <CloudIcon name="shield-check" />
            <Text textStyle="label/M/medium">{t("access.title", "Cloud access")}</Text>
          </HStack>
          <HStack gap="xs" role="group" aria-label={t("teams.account", "Cloud account")} flexWrap="wrap">
            <Button
              size="sm"
              variant="outline"
              aria-pressed={!selected}
              disabled={busy}
              onClick={() => select(undefined)}
            >
              {t("teams.personal", "Personal")}
            </Button>
            {teams.map((team) => (
              <Button
                key={team.accountId}
                size="sm"
                variant="outline"
                aria-pressed={active?.accountId === team.accountId}
                disabled={busy}
                onClick={() => select(team.accountId)}
              >
                {team.name}
              </Button>
            ))}
          </HStack>
          <HStack gap="xs" color="fg.muted">
            <CloudIcon name={features?.relay ? "circle-check" : "cloud"} />
            <Text>{access}</Text>
            {active && (
              <Text>· {active.role === "owner" ? t("teams.owner", "Owner") : t("teams.member", "Member")}</Text>
            )}
          </HStack>
          {active && (
            <ActiveTeam key={active.accountId} account={account} team={active} login={login} refresh={refresh} />
          )}
          {draft === undefined ? (
            <Button size="sm" variant="outline" alignSelf="flex-start" disabled={busy} onClick={() => setDraft("")}>
              {t("teams.create", "Create team")}
            </Button>
          ) : (
            <HStack
              as="form"
              onSubmit={(event) => {
                event.preventDefault();
                submit();
              }}
            >
              <Input
                size="sm"
                aria-label={t("teams.name", "Team name")}
                value={draft}
                maxLength={100}
                disabled={busy}
                onChange={(event) => setDraft(event.target.value)}
              />
              <Button size="sm" variant="outline" disabled={busy} onClick={() => setDraft(undefined)}>
                {t("teams.cancel", "Cancel")}
              </Button>
              <Button size="sm" variant="primary" type="submit" loading={busy} disabled={busy || !draft.trim()}>
                {t("teams.save", "Create")}
              </Button>
            </HStack>
          )}
          {join ? (
            <TeamJoin
              login={login}
              close={() => showJoin(false)}
              joined={(accountId) => {
                if (accountId) select(accountId);
                showJoin(false);
                refresh();
              }}
            />
          ) : (
            <Button size="sm" variant="outline" alignSelf="flex-start" onClick={() => showJoin(true)}>
              {t("join.open", "Use an invitation")}
            </Button>
          )}
          {error && <CloudError message={error} onClose={() => setError(undefined)} />}
        </Stack>
      </SimpleCardBody>
    </SimpleCard>
  );
};
