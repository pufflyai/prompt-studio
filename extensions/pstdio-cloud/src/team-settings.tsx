import { HStack, Text } from "@chakra-ui/react";
import type { AccountStatus, DeviceLogin, TeamAccount } from "@pstdio/sdk/extensions";
import { useWebviewCommandQuery, useWebviewVisibility } from "@pstdio/sdk/extensions/react";
import { SettingsPage } from "@pstdio/ui";
import { useState } from "react";
import { Button } from "./button";
import { useCloudContext } from "./cloud-context";
import { CloudError } from "./cloud-error";
import { CloudIcon } from "./cloud-label";
import { ManagedExtensions } from "./managed-extensions";
import { TeamEnrollment } from "./team-enrollment";
import { TeamMembers } from "./team-members";
import { TeamPicker } from "./team-picker";

interface TeamSettingsProps {
  projectId?: string;
  managed?: boolean;
}

export const TeamSettings = (props: TeamSettingsProps) => {
  const { managed } = props;
  const { client, t } = useCloudContext();
  const visible = useWebviewVisibility();
  const account = useWebviewCommandQuery(client.account.query({ service: "status" }), visible);
  const login = account.data?.signInRequired ? undefined : account.data?.login;
  if (login && account.data)
    return (
      <SignedInTeamSettings
        {...props}
        account={account.data}
        login={login}
        refresh={account.refresh}
        key={JSON.stringify([login.managerOrigin, login.accountId])}
      />
    );
  return (
    <SettingsPage
      title={managed ? t("managed.title", "Managed extensions") : t("teams.settings", "Team")}
      icon={<CloudIcon name={managed ? "package-check" : "users"} />}
    >
      {account.error ? (
        <CloudError
          inline
          message={account.error.message}
          action={
            <Button size="sm" onClick={account.refresh}>
              {t("actions.retry", "Retry")}
            </Button>
          }
        />
      ) : (
        <Text color="fg.muted">
          {account.loading
            ? t("teams.loading", "Loading teams…")
            : t("teams.signIn", "Sign in from Cloud settings to manage your team.")}
        </Text>
      )}
    </SettingsPage>
  );
};

interface SignedInTeamSettingsProps extends TeamSettingsProps {
  account: AccountStatus;
  login: DeviceLogin;
  refresh: () => void;
}

const SignedInTeamSettings = (props: SignedInTeamSettingsProps) => {
  const { projectId, managed, account, login, refresh } = props;
  const { t } = useCloudContext();
  const [selected, select] = useState<string>();
  const [created, setCreated] = useState<TeamAccount>();
  const [enrollment, setEnrollment] = useState<"create" | "join">();
  const listed = account.teamAccounts ?? [];
  const confirmed = created && listed.some((team) => team.accountId === created.accountId);
  if (confirmed) setCreated(undefined);
  const teams = created && !confirmed ? [...listed, created] : listed;
  const preferred = projectId
    ? (account.teamProjectOwners?.[projectId] ?? account.teamProjects?.[projectId])
    : undefined;
  const team =
    teams.find(({ accountId }) => accountId === selected) ??
    teams.find(({ accountId }) => accountId === preferred) ??
    teams[0];
  const actions = (
    <HStack gap="xs">
      <Button size="sm" variant="ghost" onClick={() => setEnrollment("create")}>
        {t("teams.create", "Create team")}
      </Button>
      <Button size="sm" variant="outline" onClick={() => setEnrollment("join")}>
        {t("join.accept", "Join team")}
      </Button>
    </HStack>
  );
  const picker = <TeamPicker teams={teams} selected={team?.accountId} onSelect={select} />;
  const key = JSON.stringify([team?.accountId, team?.role]);
  let content = (
    <SettingsPage
      title={managed ? t("managed.title", "Managed extensions") : t("teams.settings", "Team")}
      icon={<CloudIcon name={managed ? "package-check" : "users"} />}
    >
      <Text color="fg.muted">{t("teams.empty", "Create a team or join with an invite code.")}</Text>
      {actions}
    </SettingsPage>
  );
  if (team)
    content = managed ? (
      <ManagedExtensions key={key} team={team} login={login} projectId={projectId} selection={picker} />
    ) : (
      <TeamMembers key={key} team={team} login={login} refresh={refresh} selection={picker} actions={actions} />
    );
  return (
    <>
      {content}
      {enrollment && (
        <TeamEnrollment
          key={key}
          mode={enrollment}
          login={login}
          close={() => setEnrollment(undefined)}
          created={(team) => {
            setCreated(team);
            select(team.accountId);
            setEnrollment(undefined);
            refresh();
          }}
          joined={(accountId) => {
            if (accountId) select(accountId);
            setEnrollment(undefined);
            refresh();
          }}
        />
      )}
    </>
  );
};
