import { expect, test } from "bun:test";
import { resourceContextMenuPath } from "@pstdio/workbench";
import { buildDashboardExtensionMenuRegistrations } from "./workbench-extension-contributions";
import { extensionLabMetadata } from "./workbench-extension-metadata.fixture";

for (const slotId of ["session.headerPrimary", "session.headerOverflow"]) {
  test(`routes ${slotId} contributions to session row actions`, () => {
    const { registrations, unresolved } = buildDashboardExtensionMenuRegistrations({
      ...extensionLabMetadata,
      commands: [
        {
          id: "session.inspect",
          extensionId: "session-tools",
          title: "Inspect session",
          params: { note: { type: "text", label: "Note" } },
        },
      ],
      menuContributions: [
        {
          id: "session.inspect.menu",
          extensionId: "session-tools",
          commandId: "session.inspect",
          slotId,
          label: "Inspect session",
          when: { metadata: { status: "completed" } },
        },
      ],
    });
    expect(unresolved).toEqual([]);
    expect(registrations[0]?.menuItems).toEqual([
      expect.objectContaining({
        menuPath: resourceContextMenuPath("session"),
        menuItem: expect.objectContaining({
          when: 'workbench.resource.type == "session" && workbench.resource.metadata.status == "completed"',
        }),
      }),
    ]);
    expect(registrations[0]?.command.params).toEqual({ note: { type: "text", label: "Note" } });
  });
}
