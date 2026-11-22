import { contributionRefId, sessionBrowser } from "@pstdio/sdk/extensions";
import { ParamEditorRow } from "@pstdio/ui/param-editor";
import { getSidePanelBubblePanels, sidePanelBubblePreferences, type WorkbenchCore } from "@pstdio/workbench";
import { useWorkbenchStore } from "@pstdio/workbench/react";
import { useTranslation } from "react-i18next";

export const SidePanelBubbleSettings = (props: { workbench: WorkbenchCore }) => {
  "use no memo";

  const { workbench } = props;
  const { t } = useTranslation("settings");
  useWorkbenchStore(workbench.layout.store, (state) => state);
  useWorkbenchStore(workbench.modes.store, (state) => state.activeModeId);
  useWorkbenchStore(workbench.commands.store, (state) => state);
  useWorkbenchStore(workbench.pages.store, (state) => state);
  useWorkbenchStore(workbench.context.store, (state) => state);
  const sessionsAvailable = useWorkbenchStore(workbench.views.store, (state) =>
    Boolean(state.views[contributionRefId(sessionBrowser.views.conversation)]),
  );
  const visible = useWorkbenchStore(
    workbench.preferences.store,
    () => workbench.preferences.getValue(sidePanelBubblePreferences.visible) !== false,
  );
  const savedPanel = useWorkbenchStore(workbench.preferences.store, () =>
    workbench.preferences.getValue(sidePanelBubblePreferences.panel),
  );
  const selected = typeof savedPanel === "string" ? savedPanel : "default";
  const shown = selected === "default" && !sessionsAvailable ? "none" : selected;
  const options = [
    ...(sessionsAvailable
      ? [{ id: "default", name: t("appearance.defaultPanel", { panel: t("appearance.newSession") }) }]
      : []),
    { id: "none", name: t("appearance.sidePanel") },
    ...getSidePanelBubblePanels(workbench).map((panel) => ({ id: `panel:${panel.id}`, name: panel.title })),
  ];
  if (!options.some((option) => option.id === shown))
    options.push({ id: shown, name: t("appearance.unavailableSidePanel") });

  return (
    <>
      <ParamEditorRow
        fullWidth
        param={{
          id: "show-side-panel-bubble",
          name: t("appearance.showSidePanelBubble"),
          type: "boolean",
          defaultValue: visible,
        }}
        onChange={(_id, value) => {
          if (typeof value !== "boolean") return;
          return workbench.preferences.setValue(sidePanelBubblePreferences.visible, value, { scope: "user" });
        }}
      />
      <ParamEditorRow
        fullWidth
        param={{
          id: "default-side-panel",
          name: t("appearance.defaultSidePanel"),
          description: t("appearance.defaultSidePanelHelper"),
          type: "selection",
          defaultValue: shown,
          options,
        }}
        onChange={(_id, value) => {
          if (typeof value !== "string") return;
          return workbench.preferences.setValue(sidePanelBubblePreferences.panel, value, { scope: "user" });
        }}
      />
    </>
  );
};
