import { Box, Button, Flex, Stack, Text } from "@chakra-ui/react";
import type { ControlsQueryResult, ControlValueMap } from "@pstdio/sdk/extensions";
import { resourceKey } from "@pstdio/sdk/extensions";
import { ActionErrorSlot, AlertMessage, ScrollArea, SettingsContentSkeleton } from "@pstdio/ui";
import {
  type InputGroup,
  type Param,
  ParamEditor,
  type ParamValue,
  resolveParamEditorValues,
} from "@pstdio/ui/param-editor";
import { controlValueSchema, controlValuesSchema } from "pstdio-api-contracts";
import { type ReactNode, useContext, useEffect, useRef, useState } from "react";
import {
  type RegisteredControlsRendererContribution,
  rendererReadKey,
  type WorkbenchCore,
  type WorkbenchPanelInstance,
} from "../../../core";
import { runUserAction } from "../../../core/shared/run-user-action";
import type { CommandParamFieldRenderer } from "../../command-palette/command-param-field";
import { SettingsPageContext, useSettingsChanges } from "../../settings/settings-page-context";
import { projectControlValues } from "../collection-operation-projection";
import { RendererReadNotice } from "../renderer-read-notice";
import { useCollectionOperations } from "../use-collection-operations";
import { usePageParams } from "../use-page-params";
import { useRendererRead } from "../use-renderer-read";
import { mergeControlDraft } from "./control-draft";
import { ControlsFooter, type ControlsFooterProps } from "./controls-footer";
import { HarnessControl } from "./harness-control";

interface WorkbenchControlsViewProps {
  workbench: WorkbenchCore;
  contribution: RegisteredControlsRendererContribution;
  placement: WorkbenchPanelInstance;
  renderParamField?: CommandParamFieldRenderer;
}
interface ControlsViewState {
  params: Param[];
  groups: InputGroup[];
  values: ControlValueMap;
  readOnly: boolean;
  loading: boolean;
  changed: Record<string, number>;
  error?: string;
}
const controlsValues = (defaults: ControlValueMap | undefined, result: ControlsQueryResult | undefined) =>
  controlValuesSchema.parse(
    resolveParamEditorValues(result?.params ?? [], result?.groups ?? [], { ...defaults, ...result?.values }),
  );
const initialState: ControlsViewState = {
  params: [],
  groups: [],
  values: {},
  changed: {},
  readOnly: false,
  loading: true,
};
const controlsLayout = (dialog: boolean) => ({
  height: dialog ? "auto" : "full",
  contentProps: dialog ? { px: "sm", py: "md" } : undefined,
});
export const WorkbenchControlsView = (props: WorkbenchControlsViewProps) => {
  const { contribution, placement } = props;
  return <WorkbenchControlsForm key={JSON.stringify([contribution.id, resourceKey(placement.resource)])} {...props} />;
};
const WorkbenchControlsForm = (props: WorkbenchControlsViewProps) => {
  const { workbench, contribution, placement, renderParamField } = props;
  const resource = placement.resource;
  const settingsPage = useContext(SettingsPageContext);
  const dialog = workbench.layout
    .getLayout()
    .regions.overlay.widgets.some((item) => item.widgetId === placement.instanceId);
  const layout = controlsLayout(dialog);
  const close = () => workbench.layout.closePanel(placement.instanceId);
  const pageParams = usePageParams(workbench, placement);
  const [state, setState] = useState<ControlsViewState>(initialState);
  const [pending, setPending] = useState(false);
  const changes = useRef(0);
  const query = {
    sourceId: contribution.id,
    queryScope: contribution.queryScope,
    dependency: { resourceKey: resourceKey(resource), resourceId: resource?.id },
    queryKey: JSON.stringify([contribution.id, resourceKey(resource), pageParams]),
  };
  const read = useRendererRead({
    ...query,
    workbench,
    ownerKey: rendererReadKey(placement),
    queryEvents: contribution.queryEvents,
    load: (signal) => contribution.executeQuery(resource, signal, pageParams),
    subscribe: contribution.subscribe,
  });
  const row = { id: resource?.id ?? "controls", resource };
  const mutations = useCollectionOperations(workbench, query, [row]);
  const accepted = read.acceptedValue;
  const rowId = row.id;
  useEffect(() => {
    if (!accepted) {
      setState(initialState);
      return;
    }
    const result = accepted;
    const saved = projectControlValues(
      controlsValues(contribution.defaultValues, result),
      { id: rowId, resource },
      mutations.pending,
      contribution.id,
      query.queryScope?.projectId,
    );
    setState((previous) => ({
      ...previous,
      params: result.params ?? [],
      groups: result.groups ?? [],
      values: mergeControlDraft(previous.values, saved, previous.changed),
      readOnly: Boolean(result.readOnly),
      loading: false,
    }));
  }, [
    accepted,
    contribution.defaultValues,
    contribution.id,
    mutations.pending,
    query.queryScope?.projectId,
    resource,
    rowId,
  ]);
  const readOnly = state.readOnly || (!contribution.updateValue && !contribution.apply);
  const showFooter =
    Boolean(read.value) &&
    !state.loading &&
    !state.readOnly &&
    (Boolean(contribution.apply) || Boolean(contribution.reset));
  const handleChange = (id: string, input: ParamValue) => {
    const value = controlValueSchema.parse(input);
    // The command runs outside the setState updater: React may invoke updaters
    // twice (StrictMode), which would double-execute the update command.
    const values = { ...state.values, [id]: value };
    const revision = ++changes.current;
    if (contribution.updateValue)
      void runUserAction(workbench, "Update value", async () => {
        await mutations.submit({ rowId, attributes: { [id]: value } }, () =>
          contribution.updateValue!({ controlId: id, value, values, resource }),
        );
        setState((previous) => {
          if (previous.changed[id] !== revision) return previous;
          const changed = { ...previous.changed };
          delete changed[id];
          return { ...previous, changed };
        });
      });
    setState((prev) => ({
      ...prev,
      values: { ...prev.values, [id]: value },
      changed: { ...prev.changed, [id]: revision },
      error: undefined,
    }));
  };
  const submit = async (reset: boolean) => {
    setPending(true);
    setState((previous) => ({ ...previous, error: undefined }));
    try {
      await mutations.submit(
        { rowId, attributes: reset ? (contribution.defaultValues ?? {}) : state.values },
        async () => {
          if (reset) await contribution.reset?.({ resource });
          else await contribution.apply?.({ values: state.values, resource });
        },
      );
      setState((previous) => {
        const changed = Object.fromEntries(
          Object.entries(previous.changed).filter(([id, revision]) => state.changed[id] !== revision),
        );
        const values = reset
          ? mergeControlDraft(previous.values, controlsValues(contribution.defaultValues, read.acceptedValue), changed)
          : previous.values;
        return { ...previous, changed, values };
      });
    } catch (error) {
      setState((previous) => ({ ...previous, error: error instanceof Error ? error.message : String(error) }));
      if (settingsPage) throw error;
    } finally {
      setPending(false);
    }
  };
  useSettingsChanges(
    settingsPage && contribution.apply
      ? {
          dirty: Object.keys(state.changed).length > 0,
          saving: pending,
          onSave: () => submit(false),
          onReset: () =>
            setState((previous) => ({
              ...previous,
              changed: {},
              error: undefined,
              values: controlsValues(contribution.defaultValues, read.value),
            })),
        }
      : undefined,
  );
  const actionError = state.error ? (
    <AlertMessage
      compact
      status="error"
      title={state.error}
      onClose={() => setState((previous) => ({ ...previous, error: undefined }))}
    />
  ) : null;
  if (settingsPage)
    return (
      <Stack gap="md" position="relative">
        {read.error ? <RendererReadNotice error={read.error} retry={read.retry} /> : null}
        <SettingsControlsReset contribution={contribution} pending={pending} submit={submit} error={actionError} />
        <ControlsContent
          state={read.value ? state : initialState}
          contribution={contribution}
          readOnly={readOnly}
          onChange={handleChange}
          renderParamField={renderParamField}
        />
      </Stack>
    );
  return (
    <Stack position="relative" h={layout.height} minH="0" gap="0" bg="bg" overflow="hidden">
      {read.error ? <RendererReadNotice error={read.error} retry={read.retry} /> : null}
      {actionError && <ActionErrorSlot>{actionError}</ActionErrorSlot>}
      <ScrollArea flex="1" minH="0" minW="0" w="full" size="xs" contentProps={layout.contentProps}>
        {read.value || read.loading ? (
          <ControlsContent
            state={read.value ? state : initialState}
            contribution={contribution}
            readOnly={readOnly}
            onChange={handleChange}
            renderParamField={renderParamField}
          />
        ) : null}
      </ScrollArea>
      <ControlsFooter
        visible={showFooter}
        contribution={contribution}
        pending={pending}
        submit={submit}
        dialog={dialog}
        onClose={placement.closable ? close : undefined}
      />
    </Stack>
  );
};

const SettingsControlsReset = (props: Omit<ControlsFooterProps, "visible"> & { error: ReactNode }) => {
  if (!props.contribution.reset || props.contribution.apply) return null;
  return (
    <Flex gap="xs">
      <Box position="relative" flex="1" minW="0">
        {props.error && <ActionErrorSlot edge="top">{props.error}</ActionErrorSlot>}
      </Box>
      <Button
        size="sm"
        variant="ghost"
        disabled={props.pending}
        onClick={() => void props.submit(true).catch(() => undefined)}
      >
        Reset to defaults
      </Button>
    </Flex>
  );
};

interface ControlsContentProps {
  state: ControlsViewState;
  contribution: RegisteredControlsRendererContribution;
  readOnly: boolean;
  onChange(id: string, value: ParamValue): void;
  renderParamField?: CommandParamFieldRenderer;
}
const ControlsContent = (props: ControlsContentProps) => {
  const { state, contribution, readOnly, onChange, renderParamField } = props;
  const settingsPage = useContext(SettingsPageContext);
  // Host-backed controls reuse command fields; the UI editor still owns group layout.
  const hostParam = (param: Param): Param => {
    if (param.type !== "harness") return param;
    return {
      id: param.id,
      name: "",
      type: "property",
      value: (
        <HarnessControl
          param={param}
          value={state.values[param.id] ?? param.defaultValue}
          readOnly={readOnly}
          renderParamField={renderParamField}
          onChange={(value) => onChange(param.id, value)}
        />
      ),
    };
  };
  if (state.loading) return <SettingsContentSkeleton />;
  if (state.params.length || state.groups.length)
    return (
      <ParamEditor
        changeDelay={contribution.apply ? 0 : undefined}
        fullWidth={!settingsPage}
        params={state.params.map(hostParam)}
        groups={state.groups.map((group) => ({ ...group, params: group.params.map(hostParam) }))}
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
