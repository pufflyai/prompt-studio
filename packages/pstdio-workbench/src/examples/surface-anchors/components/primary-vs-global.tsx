import { Box, Stack, Text } from "@chakra-ui/react";
import { useWorkbenchStore, type WorkbenchWidgetRenderInput } from "../../../react";

interface SignalRowProps {
  label: string;
  resourceLabel: string | undefined;
  hint: string;
}

const SignalRow = (props: SignalRowProps) => {
  const { label, resourceLabel, hint } = props;

  return (
    <Box>
      <Text textStyle="label/S/regular" color="fg">
        {label}: {resourceLabel ?? "—"}
      </Text>
      <Text textStyle="paragraph/XS/regular" color="fg.muted">
        {hint}
      </Text>
    </Box>
  );
};

// Shows the two active-resource signals side by side. Activating a side anchor (clicking
// into the floating session) moves the GLOBAL signal but leaves PRIMARY on the workspace —
// which is why projections, history and lastResource follow primary, not global.
export const PrimaryVsGlobalPanel = (props: { input: WorkbenchWidgetRenderInput }) => {
  const { workbench } = props.input;
  // Re-render on any layout change so both signals stay live.
  useWorkbenchStore(workbench.layout.store, (state) => state.layout);

  return (
    <Stack gap="3" p="4" h="full" minH="0">
      <Text textStyle="label/S/regular" color="fg">
        Primary vs global
      </Text>
      <SignalRow
        label="primary"
        resourceLabel={workbench.getPrimaryResource()?.label}
        hint="main anchor only — what projections follow"
      />
      <SignalRow
        label="global active"
        resourceLabel={workbench.getActiveResource()?.label}
        hint="last activated widget in ANY area"
      />
    </Stack>
  );
};
