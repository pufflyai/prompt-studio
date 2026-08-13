import { HStack, Text } from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";
import { footageArchive } from "../data/footage-archive";
import { useLabHost, useLabHostProps } from "../hooks/host-context";
import { createLabView } from "../renderers/lab-view-shell";

const rowCountFromValue = (value: unknown) => {
  if (value && typeof value === "object" && "rows" in value && Array.isArray(value.rows)) return value.rows.length;
  return undefined;
};

const camLabelFromValue = (value: unknown) => {
  if (!value || typeof value !== "object" || !("camId" in value)) return undefined;
  return footageArchive.find((entry) => entry.id === value.camId)?.camera;
};

// Only mutations refresh the strip. Refreshing on every command event would loop
// forever: the strip's own queries publish command events too.
const refreshTriggers = new Set([
  "extension-lab.glass-lab-artifacts.create",
  "extension-lab.glass-lab-artifacts.delete",
  "extension-lab.artifact-menu.update",
  "extension-lab.parameters.apply",
  "extension-lab.cams.select",
]);

// A one-widget status strip: the `status` region renders a single active widget,
// so the extension composes its items itself.
const LabStatusBar = () => {
  const { host, t } = useLabHost();
  const { lastCommand } = useLabHostProps();
  const [artifactCount, setArtifactCount] = useState<number>();
  const [camLabel, setCamLabel] = useState<string>();
  // Tracks the last mutation tick that ran a refresh, so the strip's own query
  // events neither re-trigger a load nor cancel one that is still in flight.
  const loadedTickRef = useRef<number>(undefined);

  useEffect(() => {
    if (lastCommand && !refreshTriggers.has(lastCommand.commandId)) return;
    const tick = lastCommand?.tick;
    if (tick !== undefined && loadedTickRef.current === tick) return;
    loadedTickRef.current = tick;
    void (async () => {
      const [artifacts, cam] = await Promise.all([
        host.call<{ outcome: { value?: unknown } }>("commands.execute", {
          commandId: "extension-lab.glass-lab-artifacts.query",
          params: {},
        }),
        host.call<{ outcome: { value?: unknown } }>("commands.execute", {
          commandId: "extension-lab.cams.current",
          params: {},
        }),
      ]);
      setArtifactCount(rowCountFromValue(artifacts.outcome.value));
      setCamLabel(camLabelFromValue(cam.outcome.value));
    })();
  }, [host, lastCommand]);

  return (
    <HStack gap="md" paddingX="md" h="full" whiteSpace="nowrap">
      <Text textStyle="label/XS/medium">{t("webview.statusBar.title", "Extension Lab")}</Text>
      <Text textStyle="label/XS/regular" color="fg.muted">
        {artifactCount === undefined
          ? t("webview.statusBar.loading", "Loading…")
          : t("webview.statusBar.artifacts", "{{count}} artifacts", { count: artifactCount })}
      </Text>
      {camLabel ? (
        <Text textStyle="label/XS/regular" color="fg.muted">
          {camLabel}
        </Text>
      ) : null}
    </HStack>
  );
};

export default createLabView(() => <LabStatusBar />);
