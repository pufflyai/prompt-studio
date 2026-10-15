import { registerBoomboxExample } from "../showcases/boombox";
import { registerKilnExample } from "../showcases/kiln";
import { registerKilnSessions } from "../showcases/kiln-sessions";
import { createWindowingFixture } from "./fixture";
import { windowingExtensionId } from "./resources";

export const integratedLongNote = {
  type: "windowing.note",
  id: "long-note",
  extensionId: windowingExtensionId,
  label: "Release planning notes with a deliberately long resource name.md",
};

export const createIntegratedWindowingFixture = () => {
  const fixture = createWindowingFixture("windowing", {
    pagePanels: true,
    contextNavigation: true,
    terminalPreset: true,
    registerPages: (workbench) => {
      registerBoomboxExample(workbench);
      registerKilnExample(workbench);
      registerKilnSessions(workbench);
    },
  });
  fixture.resources.notes.push(integratedLongNote);
  return fixture;
};
