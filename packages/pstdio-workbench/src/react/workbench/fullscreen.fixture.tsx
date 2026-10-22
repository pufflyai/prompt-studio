import { Box, Input, Text } from "@chakra-ui/react";
import { type ReactNode, useEffect, useState } from "react";
import { createWorkbench, type WorkbenchSidePanelMode } from "../../core";

const Editor = (props: { name: string; mounted(): void; unmounted(): void }) => {
  const { name, mounted, unmounted } = props;
  const [value, setValue] = useState("");
  useEffect(() => {
    mounted();
    return unmounted;
  }, [mounted, unmounted]);
  return (
    <Box p="md">
      <Text>{name}</Text>
      <Input aria-label={`${name} draft`} value={value} onChange={(e) => setValue(e.target.value)} />
    </Box>
  );
};

export const createFullscreenWorkbench = (
  side: WorkbenchSidePanelMode = "attached",
  floatable = true,
  options: { hiddenNav?: boolean; renderEditor?: (name: string) => ReactNode } = {},
) => {
  const page = { kind: "page", extensionId: "fullscreen", id: "first" } as const;
  const w = createWorkbench({ startPage: page, initialSidePanelMode: "attached" });
  const lifecycle = { mounts: 0, unmounts: 0 };
  const mounted = () => lifecycle.mounts++;
  const unmounted = () => lifecycle.unmounts++;
  for (const id of ["first", "other"])
    w.modes.registerMode({
      id,
      activate() {},
      chrome: { status: "status", nav: options.hiddenNav ? false : undefined },
      regionSettings: { main: { showHeader: false }, side: { floatable } },
    });
  for (const id of ["Editor", "Session", "Terminal", "status"])
    w.views.registerView({
      id,
      title: id,
      body: {
        kind: "react",
        render: () => options.renderEditor?.(id) ?? <Editor name={id} mounted={mounted} unmounted={unmounted} />,
      },
    });
  for (const id of ["first", "second", "other"])
    w.pages.registerPage({
      id,
      ref: { ...page, id },
      path: id,
      modeId: id === "other" ? "other" : "first",
      main: { kind: "view", view: { kind: "view", id: "Editor" }, cardinality: "one" },
      slots: [],
    });
  for (const [region, id] of [
    ["side", "Session"],
    ["secondary", "Terminal"],
  ] as const)
    w.modePlacements.registerPlacement({
      id,
      ref: { kind: "placement", extensionId: "fullscreen", id },
      modeId: "first",
      region,
      item: { kind: "view", view: { kind: "view", id }, presence: "open" },
    });
  w.pageLocations.switchProject("fullscreen");
  w.pageLocations.navigate({ kind: "page", page });
  for (const region of ["side", "secondary"] as const) {
    const identity = w.layout.getLayout().regions[region].widgets[0]?.placementIdentity;
    if (identity) w.pinPlacement(identity, true);
  }
  w.shell.setRegionSize("side", 360);
  w.shell.setRegionSize("secondary", 240);
  w.shell.setSidePanelPresentation(side);
  return { w, lifecycle };
};
