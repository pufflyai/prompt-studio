import { Box, Center } from "@chakra-ui/react";
import type { ReactNode } from "react";
import type { RegisteredWidgetContribution, ShellCore, ShellWidgetPlacement } from "../../core";
import { ShellIcon } from "../shared/icon";
import { useShellStore } from "../shared/use-shell-store";

interface ShellWidgetHostProps {
  shell: ShellCore;
  placement: ShellWidgetPlacement;
  widget?: RegisteredWidgetContribution;
}

const ShellWidgetFallback = (props: { label: string }) => {
  const { label } = props;

  return (
    <Center h="full" w="full" color="fg.muted" p="md" aria-label={label}>
      <ShellIcon name="circle-alert" size={20} />
    </Center>
  );
};

const ShellRenderedWidgetFrame = (props: { children: ReactNode }) => {
  const { children } = props;

  return (
    <Box flex="1" minW="0" minH="0" w="full" h="full" overflow="hidden">
      {children}
    </Box>
  );
};

const noopRefresh = () => undefined;

export const ShellWidgetHost = (props: ShellWidgetHostProps) => {
  const { shell, placement } = props;
  const widget = props.widget ?? shell.layout.getWidget(placement.contributionId);
  const refresh = noopRefresh;
  const renderer = useShellStore(shell.renderers.store, (state) => state.renderers[widget?.rendererId ?? ""]);

  if (!widget) {
    return <ShellWidgetFallback label="Widget contribution is no longer registered." />;
  }

  return (
    <Box display="flex" minW="0" minH="0" w="full" h="full" overflow="hidden">
      {renderer ? (
        <ShellRenderedWidgetFrame>
          {renderer.render({ shell, widget, placement, refresh }) as ReactNode}
        </ShellRenderedWidgetFrame>
      ) : (
        <ShellWidgetFallback label={`No renderer registered for ${widget.rendererId}.`} />
      )}
    </Box>
  );
};
