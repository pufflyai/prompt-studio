import { Text } from "@chakra-ui/react";
import type { WorkbenchCore } from "../../core";
import { windowingExtensionId } from "./resources";

const ref = (id: string) => ({ kind: "page" as const, extensionId: windowingExtensionId, id });
export const availabilityPages = { overview: ref("overview"), library: ref("library"), scene: ref("scene") };

export const registerAvailabilityPages = (workbench: WorkbenchCore) => {
  for (const [id, label] of [
    ["boombox", "Boombox"],
    ["kiln", "Kiln"],
  ])
    workbench.modes.registerMode({ id, label, basePage: availabilityPages.overview, activate: () => undefined });
  for (const [id, label, modes] of [
    ["overview", "Overview", ["windowing", "boombox", "kiln"]],
    ["library", "Library", ["windowing", "boombox"]],
    ["scene", "Scene", ["kiln"]],
  ] as const) {
    workbench.views.registerView({
      id: `availability.${id}`,
      title: label,
      body: {
        kind: "react",
        render: () => (
          <Text p="md" aria-label="Availability page">
            {label}
          </Text>
        ),
      },
    });
    workbench.pages.registerPage({
      id: `availability.${id}`,
      ref: ref(id),
      title: label,
      path: `windowing/modes/${id}`,
      modeId: modes[0],
      modeIds: modes,
      main: { kind: "view", view: { kind: "view", id: `availability.${id}` }, cardinality: "one" },
      slots: [],
    });
  }
};
