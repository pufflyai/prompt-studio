import { Box } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { workbenchPages } from "@pstdio/sdk/extensions";
import { createWorkbench } from "@pstdio/workbench";
import { Workbench } from "@pstdio/workbench/react";
import { useState } from "react";
import { createStartModule } from "./module";

const StartPageLayout = () => {
  const [workbench] = useState(() => {
    const next = createWorkbench();
    next.modes.registerMode({ id: "project", activate() {} });
    next.registerModule(createStartModule());
    next.pageLocations.setProject("preview-start-page");
    next.pageLocations.navigate({ kind: "page", page: workbenchPages.start });
    return next;
  });
  return (
    <Box h="100dvh">
      <Workbench workbench={workbench} />
    </Box>
  );
};
const meta = {
  title: "Start/Page layout",
  component: StartPageLayout,
  fullscreen: true,
} satisfies CanvasMeta<typeof StartPageLayout>;
export default meta;
type Story = CanvasVariant<typeof meta>;
export const Default: Story = {
  id: "start-page-layout--default",
};
