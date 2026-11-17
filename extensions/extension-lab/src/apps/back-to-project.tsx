import { IconButton } from "@chakra-ui/react";
import { workbenchCommands } from "@pstdio/sdk/extensions";
import { ExampleIcon } from "../icon";
import { useExampleView } from "../view-context";
export const BackToProject = () => {
  const { host } = useExampleView();
  return (
    <IconButton
      aria-label="Back to project"
      size="xs"
      variant="ghost"
      onClick={() => host.navigate({ kind: "command", target: { command: workbenchCommands.openDefaultPage } })}
    >
      <ExampleIcon name="ArrowLeft" />
    </IconButton>
  );
};
