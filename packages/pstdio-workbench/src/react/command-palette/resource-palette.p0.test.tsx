import { expect, test } from "bun:test";
import { WorkbenchResourcePaletteIcon } from "./resource-palette";

test("resource palette presents the provider's status icon, color and accessible label", () => {
  const icon = WorkbenchResourcePaletteIcon({
    icon: "message-circle",
    indicator: { icon: "loader-circle", color: "fg.info", label: "Session status: in_progress" },
  });
  expect(icon?.props).toMatchObject({
    name: "loader-circle",
    color: "fg.info",
    role: "img",
    "aria-label": "Session status: in_progress",
  });
  expect(WorkbenchResourcePaletteIcon({ icon: "message-circle" })?.props.name).toBe("message-circle");
});
