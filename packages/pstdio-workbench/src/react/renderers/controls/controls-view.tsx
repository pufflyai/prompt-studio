import { Box, Button, Flex, Stack, Text } from "@chakra-ui/react";
import type { ControlValueMap } from "@pstdio/sdk/extensions";
import type { InputGroup, Param, ParamValue } from "@pstdio/ui";
import { ParamEditor, ScrollArea } from "@pstdio/ui";
import { controlValueSchema } from "pstdio-api-contracts";
import { useEffect, useRef, useState } from "react";
import {
  getWorkbenchRenderers,
  type RegisteredControlsRendererContribution,
  type WorkbenchCore,
  type WorkbenchPanelInstance,
} from "../../../core";

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
  const requestRef = useRef(0);
  useEffect(() => {
    let cancelled = false;
    setState(initialState);
    const runQuery = () => {
      requestRef.current += 1;
      const requestId = requestRef.current;
      Promise.resolve()
        .then(() => contribution.executeQuery(resource))
        .then((result) => {
          if (cancelled || requestRef.current !== requestId) return;
          const values = { ...(contribution.defaultValues ?? {}), ...(result.values ?? {}) };
          const next = {
            params: result.params ?? [],
            groups: result.groups ?? [],
            values,
            readOnly: Boolean(result.readOnly),
            loading: false,
          };
          setState(next);
        })
        .catch((error: unknown) => {
          if (cancelled || requestRef.current !== requestId) return;
          setState({ ...initialState, loading: false, error: error instanceof Error ? error.message : String(error) });
        });
    };
    runQuery();
    const subscription = contribution.subscribe?.(runQuery);
    const refreshSubscription = getWorkbenchRenderers(workbench).onDidRefreshControlsRenderer((event) => {
      if (event.controlsRendererId === contribution.id) runQuery();
    });
    return () => {
      cancelled = true;
      if (typeof subscription === "function") subscription();
      else subscription?.dispose();
      refreshSubscription.dispose();
    };
  }, [contribution, resource, workbench]);
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
      <ScrollArea flex="1" minH="0" minW="0" w="full" size="xs">
        <ControlsContent state={state} contribution={contribution} readOnly={readOnly} onChange={handleChange} />
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
