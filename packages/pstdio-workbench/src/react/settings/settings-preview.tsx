import { Button, Stack, Text } from "@chakra-ui/react";
import {
  DeleteConfirmationModal,
  SettingsContentSkeleton,
  SimpleCard,
  SimpleCardBody,
  TagEditor,
  type TagEditorValue,
} from "@pstdio/ui";
import { ParamEditor } from "@pstdio/ui/param-editor";
import { useEffect, useState } from "react";
import { createWorkbench, getWorkbenchRenderers } from "../../core";
import { WorkbenchIcon } from "../shared/icon";
import { Workbench } from "../workbench/workbench";
import {
  createWorkbenchSettingsModule,
  WORKBENCH_SETTINGS_NAV_WIDGET_ID,
  WORKBENCH_SETTINGS_OPEN_COMMAND_ID,
} from "./settings-module";
import { useSettingsChanges } from "./settings-page-context";

const pages = [
  { id: "runtime", title: "Runtime", icon: "Cpu", section: "workbench" },
  { id: "appearance", title: "Appearance", icon: "Palette", section: "workbench" },
  { id: "updates", title: "Update channel", icon: "CloudDownload", section: "workbench" },
  { id: "folder", title: "Project folder", icon: "GitBranch", section: "project" },
  { id: "danger", title: "Danger zone", icon: "TriangleAlert", section: "project" },
  { id: "workflow", title: "Workflow & automation", icon: "Workflow", section: "planner" },
  { id: "status", title: "Ticket status", icon: "status-progress", section: "planner" },
  { id: "tags", title: "Ticket tags", icon: "tag", section: "planner" },
  { id: "beta", title: "Beta features", icon: "FlaskConical", section: "experimental" },
];
const PreviewFields = (props: { id: string; loading?: boolean }) => {
  const { id, loading } = props;
  const [value, setValue] = useState(id === "folder" ? "Prompt Studio" : "4");
  const [saved, setSaved] = useState(id === "folder" ? "Prompt Studio" : "4");
  const [deleting, setDeleting] = useState(false);
  const [options, setOptions] = useState<TagEditorValue[]>([
    { id: "todo", name: "Todo", color: "gray", sortOrder: 0, icon: "circle", isDefault: true },
    { id: "active", name: "In progress", color: "blue", sortOrder: 1, icon: "status-progress" },
    { id: "done", name: "Done", color: "green", sortOrder: 2, icon: "check" },
  ]);
  const [savedOptions, setSavedOptions] = useState(options);
  const collection = id === "status" || id === "tags";
  const dirty = collection ? JSON.stringify(options) !== JSON.stringify(savedOptions) : value !== saved;
  useSettingsChanges(
    ["appearance", "updates", "beta", "danger"].includes(id)
      ? undefined
      : {
          dirty,
          onSave: () => {
            setSaved(value);
            setSavedOptions(options);
          },
          onReset: () => {
            setValue(saved);
            setOptions(savedOptions);
          },
        },
  );
  if (loading) return <SettingsContentSkeleton />;
  if (id === "danger")
    return (
      <>
        <SimpleCard variant="destructive">
          <SimpleCardBody>
            <Stack gap="sm">
              <Text textStyle="label/M/medium" color="fg.error">
                Delete project
              </Text>
              <Text color="fg.muted">Delete this project and all related data. This action cannot be undone.</Text>
              <Button size="sm" variant="destructive" alignSelf="start" onClick={() => setDeleting(true)}>
                <WorkbenchIcon name="Trash2" size="1em" />
                Delete project
              </Button>
            </Stack>
          </SimpleCardBody>
        </SimpleCard>
        <DeleteConfirmationModal
          open={deleting}
          onClose={() => setDeleting(false)}
          onDelete={async () => setDeleting(false)}
          headline="Delete project?"
          notificationText="This preview uses synthetic data."
          buttonText="Delete project"
        />
      </>
    );
  if (collection) return <PreviewCollection id={id} options={options} setOptions={setOptions} />;
  if (id === "appearance" || id === "updates")
    return (
      <ParamEditor
        changeDelay={0}
        fullWidth
        params={[
          {
            id: "theme",
            name: id === "appearance" ? "Theme" : "Update channel",
            type: "selection",
            options:
              id === "appearance"
                ? [
                    { id: "light", name: "Light" },
                    { id: "dark", name: "Dark" },
                  ]
                : [
                    { id: "stable", name: "Stable" },
                    { id: "nightly", name: "Nightly" },
                  ],
            defaultValue: id === "appearance" ? "light" : "stable",
          },
        ]}
      />
    );
  if (id === "workflow")
    return (
      <ParamEditor
        changeDelay={0}
        groups={[
          {
            id: "automation",
            title: "Automation",
            params: [{ id: "limit", name: "Maximum in-progress tickets", type: "number", min: 0, defaultValue: 2 }],
          },
          {
            id: "implementation",
            title: "Implementation",
            params: [
              { id: "canvas", name: "Update Canvas design", type: "boolean", defaultValue: true },
              { id: "review", name: "Adversarial review", type: "boolean", defaultValue: true },
              {
                id: "branch",
                name: "Target branch",
                type: "selection",
                defaultValue: "origin/main",
                options: [
                  { id: "origin/main", name: "origin/main" },
                  { id: "origin/release", name: "origin/release" },
                ],
              },
            ],
          },
          {
            id: "workflow",
            title: "Planner workflow",
            params: [
              {
                id: "done",
                name: "Completed statuses",
                type: "selection",
                multiSelect: true,
                defaultValue: ["done"],
                options: [
                  { id: "done", name: "Done" },
                  { id: "active", name: "In progress" },
                ],
              },
            ],
          },
        ]}
        onChange={(_id, next) => setValue(String(next))}
      />
    );
  if (id === "beta")
    return (
      <Stack gap="md">
        {[
          {
            id: "notifications",
            name: "Notifications",
            description: "Show notifications when work needs your attention or finishes.",
          },
          {
            id: "tokens",
            name: "Machine tokens",
            description: "Create project tokens that let another machine connect to this installation.",
          },
        ].map((feature) => (
          <Stack key={feature.id} gap="0">
            <ParamEditor params={[{ id: feature.id, name: feature.name, type: "boolean", defaultValue: false }]} />
            <Text px="sm" color="fg.muted" textStyle="paragraph/S/regular">
              {feature.description}
            </Text>
          </Stack>
        ))}
      </Stack>
    );
  return <PreviewGeneralFields id={id} value={value} setValue={setValue} />;
};
const PreviewGeneralFields = (props: { id: string; value: string; setValue: (value: string) => void }) => {
  const { id, value, setValue } = props;
  return (
    <ParamEditor
      changeDelay={0}
      fullWidth={id === "folder"}
      groups={[
        {
          id: "general",
          title: id === "runtime" ? "Session queue" : "Project",
          params: [
            {
              id: "value",
              name: id === "folder" ? "Project name" : "Maximum concurrent sessions",
              ...(id === "runtime"
                ? { type: "number" as const, min: 1, defaultValue: Number(value) }
                : { type: "text" as const, singleLine: true, defaultValue: value }),
            },
            ...(id === "runtime"
              ? [
                  {
                    id: "model",
                    name: "Default agent and model",
                    type: "selection" as const,
                    defaultValue: "sol",
                    options: [{ id: "sol", name: "GPT-6.1-Sol" }],
                  },
                ]
              : []),
          ],
        },
      ]}
      onChange={(_id, next) => setValue(String(next))}
    />
  );
};
const PreviewCollection = (props: {
  id: string;
  options: TagEditorValue[];
  setOptions: (options: TagEditorValue[]) => void;
}) => {
  const { id, options, setOptions } = props;
  return (
    <TagEditor
      title={id === "status" ? "Status" : "Priority"}
      framed
      showColumnHeaders
      valueColumnLabel="Name"
      values={options}
      onValuesChange={setOptions}
      onDeleteValue={(option) => setOptions(options.filter((entry) => entry.id !== option.id))}
      showDefault={id === "status"}
      onSetDefault={(option) => setOptions(options.map((entry) => ({ ...entry, isDefault: entry.id === option.id })))}
      actionsLabel="Commands"
      actionOptions={
        id === "status"
          ? [
              { value: "create", label: "Create" },
              { value: "archive_all", label: "Archive all" },
            ]
          : undefined
      }
    />
  );
};
export const SettingsPreview = (props: { navigationLoading?: boolean; contentLoading?: boolean }) => {
  const [workbench] = useState(() => createWorkbench());
  useEffect(() => {
    const contributions = workbench.registerModule({
      id: "preview.consistent-settings",
      activate(ctx) {
        for (const [id, title, order] of [
          ["workbench", "Workbench", 10],
          ["project", "Project", 20],
          ["planner", "Project Planner", 25],
          ["experimental", "Experimental", 30],
        ] as const)
          ctx.settings.registerSection({ id, title, order });
        for (const page of pages) {
          ctx.views.registerView({
            id: page.id,
            title: page.title,
            body: { kind: "react", render: () => <PreviewFields id={page.id} loading={props.contentLoading} /> },
          });
          ctx.settings.registerPanel({ ...page, scope: "global", kind: "view", viewId: page.id });
        }
      },
    });
    const settings = workbench.registerModule(createWorkbenchSettingsModule());
    if (props.navigationLoading) {
      const tree = getWorkbenchRenderers(workbench).getTreeRenderer(WORKBENCH_SETTINGS_NAV_WIDGET_ID)!;
      tree.getBody = () => new Promise(() => {});
    }
    void workbench.commands.executeCommand(WORKBENCH_SETTINGS_OPEN_COMMAND_ID, { panelId: "runtime" });
    return () => {
      settings.dispose();
      contributions.dispose();
    };
  }, [workbench, props.navigationLoading, props.contentLoading]);
  return <Workbench workbench={workbench} />;
};
