import { expect, test } from "bun:test";
import { createWorkbench } from "../../core";
import { createWorkbenchResourcePaletteEntries, WorkbenchResourcePaletteIcon } from "./resource-palette";

test("resource palette presents the provider's status icon, color and accessible label", () => {
  const icon = WorkbenchResourcePaletteIcon({
    icon: "message-circle",
    iconColor: "fg.success",
    iconLabel: "Published",
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

test("resource search displays the current owner icon without a surface indicator", () => {
  const workbench = createWorkbench();
  const [entry] = createWorkbenchResourcePaletteEntries({
    workbench,
    query: "Release",
    onClose() {},
    resources: [
      {
        resource: {
          type: "publication",
          id: "one",
          label: "Release notes",
          icon: "book-open",
          iconColor: "fg.success",
          iconLabel: "Published",
        },
        activate() {},
      },
    ],
  });
  const icon = entry.icon as import("react").ReactElement<Parameters<typeof WorkbenchResourcePaletteIcon>[0]>;
  expect(WorkbenchResourcePaletteIcon(icon.props)?.props).toMatchObject({
    name: "book-open",
    color: "fg.success",
    "aria-label": "Published",
    role: "img",
  });
  workbench.dispose();
});
