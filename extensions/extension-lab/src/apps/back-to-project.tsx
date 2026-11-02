import { IconButton } from "@chakra-ui/react";
import { ExampleIcon } from "../icon";
import { useExampleView } from "../view-context";
export const BackToProject = () => {
  const { host } = useExampleView();
  return (
    <IconButton
      aria-label="Back to project"
      size="xs"
      variant="ghost"
      onClick={() =>
        host.navigate({ kind: "page", page: { kind: "page", extensionId: "pstdio.pstdio-home", id: "home" } })
      }
    >
      <ExampleIcon name="ArrowLeft" />
    </IconButton>
  );
};
