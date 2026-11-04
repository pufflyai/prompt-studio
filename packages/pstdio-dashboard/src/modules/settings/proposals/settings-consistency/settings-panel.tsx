import { AlertMessage } from "@pstdio/ui";
import { ParamEditor, type ParamValueMap } from "@pstdio/ui/param-editor";
import { useState } from "react";
import { DangerZone } from "./danger-zone";
import { PlannerCollectionEditor } from "./planner-editors";
import { settingsPages } from "./settings-fixtures";
import { SettingsContentSkeleton } from "./settings-loading";
import { SettingsPage } from "./settings-page";

interface SettingsPanelProps {
  pageId: string;
  state?: "ready" | "error" | "loading";
}

// One page rhythm for host settings and extension settings, composed from the
// existing editor. Navigation and the settings overlay remain the real workbench.
export const SettingsPanel = (props: SettingsPanelProps) => {
  if (props.state === "loading")
    return (
      <SettingsPage pageId={props.pageId}>
        <SettingsContentSkeleton />
      </SettingsPage>
    );
  if (props.pageId === "ticket-status" || props.pageId === "ticket-tags")
    return <PlannerCollectionEditor pageId={props.pageId} />;
  if (props.pageId === "danger-zone") return <DangerZone />;
  return <SettingsForm {...props} />;
};

const SettingsForm = (props: SettingsPanelProps) => {
  const { pageId, state = "ready" } = props;
  const page = settingsPages.find((entry) => entry.id === pageId)!;
  const [values, setValues] = useState<ParamValueMap>(() =>
    Object.fromEntries(
      page.groups.flatMap((group) =>
        group.params.flatMap((param) =>
          "defaultValue" in param && param.defaultValue !== undefined ? [[param.id, param.defaultValue]] : [],
        ),
      ),
    ),
  );
  const [saved, setSaved] = useState(values);
  const [failed, setFailed] = useState(state === "error");
  const dirty = JSON.stringify(values) !== JSON.stringify(saved);
  // Existing runtime and project-name changes need an explicit save. Other
  // settings remain live; this proposal does not change that interaction contract.
  const explicitSave = pageId === "runtime" || pageId === "folder";
  const groups = page.groups.map((group) => ({
    ...group,
    params: group.params.filter((param) => param.id !== "concurrency" || values.unlimited !== true),
  }));

  return (
    <SettingsPage
      pageId={pageId}
      changes={
        state !== "loading" && (explicitSave || failed)
          ? {
              dirty: dirty || failed,
              onReset: () => {
                setValues(saved);
                setFailed(false);
              },
              onSave: () => {
                setSaved(values);
                setFailed(false);
              },
            }
          : undefined
      }
    >
      {state === "loading" ? (
        <SettingsContentSkeleton />
      ) : (
        <>
          <ParamEditor
            groups={groups}
            defaultValues={values}
            onChange={(id, value) => setValues((current) => ({ ...current, [id]: value }))}
          />
          {failed ? (
            <AlertMessage status="error" title="Settings could not be saved" onClose={() => setFailed(false)}>
              Your changes are still here. Try saving again.
            </AlertMessage>
          ) : null}
        </>
      )}
    </SettingsPage>
  );
};
