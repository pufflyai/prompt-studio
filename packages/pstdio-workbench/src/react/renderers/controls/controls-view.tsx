import { Box, Button, Flex, Stack, Text } from "@chakra-ui/react";
import type { ControlValueMap } from "@pstdio/sdk/extensions";
import { resourceKey } from "@pstdio/sdk/extensions";
import { ScrollArea } from "@pstdio/ui";
import { type InputGroup, type Param, ParamEditor, type ParamValue } from "@pstdio/ui/param-editor";
import { controlValueSchema } from "pstdio-api-contracts";
import { useEffect, useState } from "react";
import {
  getWorkbenchRenderers,
  type RegisteredControlsRendererContribution,
  rendererReadKey,
  type WorkbenchCore,
  type WorkbenchPanelInstance,
} from "../../../core";
import { RendererReadNotice } from "../renderer-read-notice";
import { useRendererRead } from "../use-renderer-read";

interface WorkbenchControlsViewProps {
  workbench: WorkbenchCore;
  contribution: RegisteredControlsRendererContribution;
  placement: WorkbenchPanelInstance;
}
interface ControlsViewState {
  params: Param[];
  groups: InputGroup[];
  values: ControlValueMap;
  readOnly: boolean;
  loading: boolean;
  error?: string;
}
const initialState: ControlsViewState = { params: [], groups: [], values: {}, readOnly: false, loading: true };
export const WorkbenchControlsView = (props: WorkbenchControlsViewProps) => {
  const { workbench, contribution, placement } = props;
  const resource = placement.resource;
  const [state, setState] = useState<ControlsViewState>(initialState);
  const read = useRendererRead({
    workbench,
    ownerKey: rendererReadKey(placement),
    queryKey: JSON.stringify([contribution.id, resourceKey(resource)]),

    load: (signal) => contribution.executeQuery(resource, signal),
    subscribe: (refresh) => {
      const subscription = contribution.subscribe?.(refresh);
      const events = getWorkbenchRenderers(workbench).onDidRefreshControlsRenderer((event) => {
        if (event.controlsRendererId === contribution.id) refresh();
      });
      return () => {
        if (typeof subscription === "function") subscription();
        else subscription?.dispose();
        events.dispose();
      };
    },
  });
  useEffect(() => {
    if (!read.value) {
      setState(initialState);
      return;
    }
    const result = read.value;
    setState({
      params: result.params ?? [],
      groups: result.groups ?? [],
      values: { ...(contribution.defaultValues ?? {}), ...(result.values ?? {}) },
      readOnly: Boolean(result.readOnly),
      loading: false,
    });
  }, [read.value, contribution.defaultValues]);
  const readOnly = state.readOnly || (!contribution.updateValue && !contribution.apply);
  const showFooter = !readOnly && (Boolean(contribution.apply) || Boolean(contribution.reset));
  const handleChange = (id: string, input: ParamValue) => {
    const value = controlValueSchema.parse(input);
    // The command runs outside the setState updater: React may invoke updaters
    // twice (StrictMode), which would double-execute the update command.
    const values = { ...state.values, [id]: value };
    if (contribution.updateValue) void contribution.updateValue({ controlId: id, value, values, resource });
    setState((prev) => ({ ...prev, values: { ...prev.values, [id]: value } }));
  };
  return (
    <Stack h="full" minH="0" gap="0" bg="bg" overflow="hidden">
      {read.error ? <RendererReadNotice error={read.error} retry={read.retry} /> : null}
      <ScrollArea flex="1" minH="0" minW="0" w="full" size="xs">
        {read.value || read.loading ? (
          <ControlsContent state={state} contribution={contribution} readOnly={readOnly} onChange={handleChange} />
        ) : null}
      </ScrollArea>
      {showFooter ? (
        <Flex borderTopWidth="1px" borderColor="border.muted" px="sm" py="xs" gap="xs" justifyContent="flex-end">
          {contribution.reset ? (
            <Button
              size="xs"
              variant="ghost"
              onClick={() => {
                void contribution.reset?.({ resource });
              }}
            >
              Reset
            </Button>
          ) : null}
          {contribution.apply ? (
            <Button
              size="xs"
              variant="subtle"
              onClick={() => {
                void contribution.apply?.({ values: state.values, resource });
              }}
            >
              Apply
            </Button>
          ) : null}
        </Flex>
      ) : null}
    </Stack>
  );
};

interface ControlsContentProps {
  state: ControlsViewState;
  contribution: RegisteredControlsRendererContribution;
  readOnly: boolean;
  onChange(id: string, value: ParamValue): void;
}
const ControlsContent = (props: ControlsContentProps) => {
  const { state, contribution, readOnly, onChange } = props;
  if (state.loading)
    return (
      <Box p="md">
        <Text textStyle="label/S/regular" color="fg.muted">
          Loading…
        </Text>
      </Box>
    );
  if (state.error)
    return (
      <Box p="md">
        <Text role="alert" textStyle="paragraph/S/regular" color="fg">
          {state.error}
        </Text>
      </Box>
    );
  if (state.params.length || state.groups.length)
    return (
      <ParamEditor
        variant="small"
        params={state.params}
        groups={state.groups}
        defaultValues={state.values}
        readOnly={readOnly}
        onChange={onChange}
      />
    );
  return (
    <Box p="md">
      <Text textStyle="label/M/medium" color="fg">
        {contribution.emptyTitle || "No controls"}
      </Text>
      {contribution.emptyDescription ? (
        <Text textStyle="label/S/regular" color="fg.muted" mt="2xs">
          {contribution.emptyDescription}
        </Text>
      ) : null}
    </Box>
  );
};
