import { Spinner, Stack, Text } from "@chakra-ui/react";
import { createWebviewClient, defineExtensionView, type GuestHost } from "@pstdio/sdk/extensions";
import { AlertMessage, type Param, ParamEditor, type ParamEditorProps, ScrollArea } from "@pstdio/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type extension from "../../extension";
import type { implementationTargetsCommand, setImplementationTargetCommand } from "../commands/implementation-targets";
import type { Translate } from "./tag-settings-section";
import { renderTicketRoot } from "./view-root";

type Commands = {
  "implementation-targets": typeof implementationTargetsCommand;
  "set-implementation-target": typeof setImplementationTargetCommand;
};
type Targets = Awaited<ReturnType<typeof implementationTargetsCommand.run>>;

interface ImplementationSettingsFieldsProps {
  adversarialReview: boolean;
  openPr: boolean;
  targets: Targets;
  saving?: boolean;
  t: Translate;
  onChange: NonNullable<ParamEditorProps["onChange"]>;
}

export const ImplementationSettingsFields = (props: ImplementationSettingsFieldsProps) => {
  const { adversarialReview, openPr, targets, saving, t, onChange } = props;
  const fields: Param[] = [
    {
      id: "implementation.adversarialReview",
      name: t("settings.implementation.adversarialReview.title", "Adversarial review"),
      type: "boolean",
      defaultValue: adversarialReview,
    },
    {
      id: "implementation.openPr",
      name: t("settings.implementation.openPr.title", "Open PR"),
      type: "boolean",
      defaultValue: openPr,
    },
  ];
  if (targets) {
    fields.push({
      id: "implementation.defaultTargetBranch",
      name: t("settings.implementation.defaultTargetBranch.title", "Default target branch"),
      type: "selection" as const,
      defaultValue: targets.selected,
      options: [...new Set([...targets.branches, ...[targets.selected].filter(Boolean)])].map((branch) => ({
        id: branch,
        name: branch,
        icon: "GitBranch",
      })),
      placeholder: t("settings.implementation.repositoryDefault", "Repository default"),
      searchable: true,
      clearable: true,
    });
  }
  return (
    <Stack gap="sm">
      <ParamEditor params={fields} onChange={onChange} readOnly={saving} />
      {!targets ? (
        <Text textStyle="paragraph/S/regular" color="fg.muted">
          {t("settings.implementation.noGitFolder", "Remote branches require a local Git folder.")}
        </Text>
      ) : null}
    </Stack>
  );
};

const SETTINGS_KEY = ["implementation-settings"];

const ImplementationSettingsPanel = (props: { host: GuestHost; t: Translate }) => {
  const { host, t } = props;
  const client = createWebviewClient<Commands, typeof extension.settings>(host);
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: SETTINGS_KEY,
    queryFn: async () => {
      const [targets, settings] = await Promise.all([
        client.commands["implementation-targets"](),
        client.settings.all(),
      ]);
      return { targets, settings };
    },
  });
  const save = useMutation({
    mutationFn: async (input: { id: string; value: unknown }) => {
      if (input.id === "implementation.adversarialReview" || input.id === "implementation.openPr") {
        await client.settings.set(input.id, input.value === true);
      } else {
        await client.commands["set-implementation-target"]({ branch: String(input.value) });
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: SETTINGS_KEY }),
  });
  const error = query.error ?? save.error;
  return (
    <ScrollArea h="full" contentProps={{ p: "md" }}>
      <Stack gap="sm">
        {error ? (
          <AlertMessage
            status="error"
            title={t("settings.implementation.error", "Could not update implementation settings")}
          >
            {error.message}
          </AlertMessage>
        ) : null}
        {query.isPending ? <Spinner size="sm" /> : null}
        {query.data ? (
          <ImplementationSettingsFields
            adversarialReview={query.data.settings["implementation.adversarialReview"] === true}
            openPr={query.data.settings["implementation.openPr"] === true}
            targets={query.data.targets}
            saving={save.isPending}
            t={t}
            onChange={(id, value) => save.mutate({ id, value })}
          />
        ) : null}
      </Stack>
    </ScrollArea>
  );
};

export default defineExtensionView({
  render({ mount, host, t }) {
    return renderTicketRoot(mount, <ImplementationSettingsPanel host={host} t={t} />);
  },
});
