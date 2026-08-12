import { Box, Button, Flex, Stack, Text } from "@chakra-ui/react";
import type { InputGroup, Param, ParamValue, ParamValueMap, ResourceRefValue } from "@pstdio/ui";
import { ParamEditor, ScrollArea } from "@pstdio/ui";
import { useEffect, useRef, useState } from "react";
import type { RegisteredControlsRendererContribution, WorkbenchCore, WorkbenchPanelInstance } from "../../../core";

// A resource param chip carries a serializable ref; open it as a workbench tab so
// links (e.g. a ticket's parent/dependency) navigate like the old webview did.
const openResourceRef = (workbench: WorkbenchCore, ref: ResourceRefValue) => {
  void workbench.resources
    .openResource(
      {
        kind: ref.type,
        uri: `pstdio://extension-resource/${encodeURIComponent(ref.type)}/${encodeURIComponent(ref.id)}`,
        id: ref.id,
        label: ref.label,
      },
      { replaceActive: true },
    )
    .catch(() => undefined);
};

interface WorkbenchControlsViewProps {
  workbench: WorkbenchCore;
  contribution: RegisteredControlsRendererContribution;
  placement: WorkbenchPanelInstance;
}

interface ControlsViewState {
  params: Param[];
  groups: InputGroup[];
  values: ParamValueMap;
  readOnly: boolean;
  loading: boolean;
}

const initialState: ControlsViewState = { params: [], groups: [], values: {}, readOnly: false, loading: true };

// Panels and menus unmount when they deactivate; the last state renders instantly
// on the next mount while the fresh query runs.
const lastStates = new Map<string, ControlsViewState>();

const stateCacheKey = (contributionId: string, placement: WorkbenchPanelInstance) =>
  `${contributionId} ${placement.resource?.uri ?? ""}`;

export const WorkbenchControlsView = (props: WorkbenchControlsViewProps) => {
  const { workbench, contribution, placement } = props;
  const resource = placement.resource;
  const cacheKey = stateCacheKey(contribution.id, placement);
  const [state, setState] = useState<ControlsViewState>(() => lastStates.get(cacheKey) ?? initialState);
  const requestRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const runQuery = () => {
      requestRef.current += 1;
      const requestId = requestRef.current;
      Promise.resolve(contribution.executeQuery(resource)).then((result) => {
        if (cancelled || requestRef.current !== requestId) return;
        const values = { ...(contribution.defaultValues ?? {}), ...(result.values ?? {}) } as ParamValueMap;
        const next = {
          params: (result.params ?? []) as Param[],
          groups: (result.groups ?? []) as InputGroup[],
          values,
          readOnly: Boolean(result.readOnly),
          loading: false,
        };
        lastStates.set(cacheKey, next);
        setState(next);
      });
    };
    runQuery();

    const subscription = contribution.subscribe?.(runQuery);
    const refreshSubscription = workbench.renderers.onDidRefreshControlsRenderer((event) => {
      if (event.controlsRendererId === contribution.id) runQuery();
    });
    return () => {
      cancelled = true;
      if (typeof subscription === "function") subscription();
      else subscription?.dispose();
      refreshSubscription.dispose();
    };
  }, [cacheKey, contribution, resource, workbench]);

  const readOnly = state.readOnly || (!contribution.updateValue && !contribution.apply);
  const hasControls = state.params.length > 0 || state.groups.length > 0;
  const showFooter = !readOnly && (Boolean(contribution.apply) || Boolean(contribution.reset));

  const handleChange = (id: string, value: ParamValue) => {
    // The command runs outside the setState updater: React may invoke updaters
    // twice (StrictMode), which would double-execute the update command.
    const values = { ...state.values, [id]: value };
    if (contribution.updateValue) void contribution.updateValue({ controlId: id, value, values, resource });
    setState((prev) => ({ ...prev, values: { ...prev.values, [id]: value } }));
  };

  return (
    <Stack h="full" minH="0" gap="0" bg="bg" overflow="hidden">
      <ScrollArea flex="1" minH="0" minW="0" w="full" size="xs">
        {state.loading ? (
          <Box p="md">
            <Text textStyle="label/S/regular" color="fg.muted">
              Loading…
            </Text>
          </Box>
        ) : hasControls ? (
          <ParamEditor
            variant="small"
            params={state.params}
            groups={state.groups}
            defaultValues={state.values}
            readOnly={readOnly}
            onChange={handleChange}
            onOpenResource={(ref) => openResourceRef(workbench, ref)}
          />
        ) : (
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
        )}
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
