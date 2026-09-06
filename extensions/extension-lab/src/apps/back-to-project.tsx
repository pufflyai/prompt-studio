import { IconButton } from "@chakra-ui/react";
import { workbenchPages } from "@pstdio/sdk/extensions";
import { ExampleIcon } from "../icon";
import { useExampleView } from "../view-context";
export const BackToProject = () => {
  const { host } = useExampleView();
  return (
    <IconButton
      aria-label="Back to project"
      size="xs"
      variant="ghost"
      onClick={() => host.navigate({ kind: "page", page: workbenchPages.start })}
    >
      <ExampleIcon name="ArrowLeft" />
    </IconButton>
  );
};
