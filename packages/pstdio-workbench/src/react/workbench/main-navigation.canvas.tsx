import { Box } from "@chakra-ui/react";
import { useState } from "react";
import { createArrangementWorkbench } from "../region/panel-arrangement-workbench";
import { WorkbenchThemeProvider } from "../theme/workbench-theme-provider";
import { Workbench } from "./workbench";

export default { title: "Product/Workbench/Main navigation", fullscreen: true };
const Preview = (props: { bottom?: boolean; dark?: boolean }) => {
  const [workbench] = useState(() => {
    const core = createArrangementWorkbench();
    if (props.bottom) core.shell.repositionPanel("main", "bottom");
    return core;
  });
  return (
    <WorkbenchThemeProvider initialThemePreference={props.dark ? "pstdio-dark" : "pstdio-light"}>
      <Box h="100dvh">
        <Workbench workbench={workbench} />
      </Box>
    </WorkbenchThemeProvider>
  );
};
export const MainAboveBottom = () => <Preview />;
export const MainBelowBottom = () => <Preview bottom />;
export const MainBelowBottomDark = () => <Preview bottom dark />;
