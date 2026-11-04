import { Box, Button, Flex, Stack, Text } from "@chakra-ui/react";
import type { ControlValueMap } from "@pstdio/sdk/extensions";
import { resourceKey } from "@pstdio/sdk/extensions";
import { ScrollArea, SettingsContentSkeleton } from "@pstdio/ui";
import { type InputGroup, type Param, ParamEditor, type ParamValue } from "@pstdio/ui/param-editor";
import { controlValueSchema } from "pstdio-api-contracts";
import { useContext, useEffect, useRef, useState } from "react";
import {
  getWorkbenchRenderers,
  type RegisteredControlsRendererContribution,
  rendererReadKey,
  type WorkbenchCore,
  type WorkbenchPanelInstance,
} from "../../../core";
import { runUserAction } from "../../../core/shared/run-user-action";
import type { CommandParamFieldRenderer } from "../../command-palette/command-param-field";
import { SettingsPageContext, useSettingsChanges } from "../../settings/settings-page-context";
import { RendererReadNotice } from "../renderer-read-notice";
import { usePageParams } from "../use-page-params";
import { useRendererRead } from "../use-renderer-read";
import { mergeControlDraft } from "./control-draft";
import { createControlSaveQueue } from "./control-save-queue";
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
const initialState: ControlsViewState = {
  params: [],
  groups: [],
  values: {},
  changed: {},
  readOnly: false,
  loading: true,
};
export const WorkbenchControlsView = (props: WorkbenchControlsViewProps) => {
  const { contribution, placement } = props;
  return <WorkbenchControlsForm key={JSON.stringify([contribution.id, resourceKey(placement.resource)])} {...props} />;
};
const WorkbenchControlsForm = (props: WorkbenchControlsViewProps) => {
  const { workbench, contribution, placement, renderParamField } = props;
  const resource = placement.resource;
  const settingsPage = useContext(SettingsPageContext);
  const pageParams = usePageParams(workbench, placement);
  const [state, setState] = useState<ControlsViewState>(initialState);
  const [pending, setPending] = useState(false);
  const saves = useRef(createControlSaveQueue());
  const changes = useRef(0);
  const read = useRendererRead({
    workbench,
    ownerKey: rendererReadKey(placement),
    queryKey: JSON.stringify([contribution.id, resourceKey(resource), pageParams]),

    load: (signal) => contribution.executeQuery(resource, signal, pageParams),
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
    setState((previous) => ({
      ...previous,
      params: result.params ?? [],
      groups: result.groups ?? [],
      values: mergeControlDraft(
        previous.values,
        { ...(contribution.defaultValues ?? {}), ...(result.values ?? {}) },
        previous.changed,
      ),
      readOnly: Boolean(result.readOnly),
      loading: false,
    }));
  }, [read.value, contribution.defaultValues]);
  const readOnly = pending || state.readOnly || (!contribution.updateValue && !contribution.apply);
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
      void runUserAction(workbench, "Update value", () =>
        saves.current(async () => {
          try {
            await contribution.updateValue!({ controlId: id, value, values, resource });
          } finally {
            setState((previous) => {
              if (previous.changed[id] !== revision) return previous;
              const changed = { ...previous.changed };
              delete changed[id];
              return { ...previous, changed };
            });
            await read.retry();
          }
        }),
      );
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
      if (reset) await contribution.reset?.({ resource });
      else await contribution.apply?.({ values: state.values, resource });
      setState((previous) => ({
        ...previous,
        changed: {},
        values: reset ? { ...contribution.defaultValues, ...read.value?.values } : previous.values,
      }));
      await read.retry();
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
              values: { ...contribution.defaultValues, ...read.value?.values },
            })),
        }
      : undefined,
  );
  if (settingsPage)
    return (
      <Stack gap="md">
        {read.error ? <RendererReadNotice error={read.error} retry={read.retry} /> : null}
        {state.error ? (
          <Text role="alert" color="fg.error">
            {state.error}
          </Text>
        ) : null}
        <SettingsControlsReset contribution={contribution} pending={pending} submit={submit} />
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
    <Stack h="full" minH="0" gap="0" bg="bg" overflow="hidden">
      {read.error ? <RendererReadNotice error={read.error} retry={read.retry} /> : null}
      {state.error ? (
        <Box p="sm">
          <Text role="alert" textStyle="paragraph/S/regular" color="fg">
            {state.error}
          </Text>
        </Box>
      ) : null}
      <ScrollArea flex="1" minH="0" minW="0" w="full" size="xs">
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
      <ControlsFooter visible={showFooter} contribution={contribution} pending={pending} submit={submit} />
    </Stack>
  );
};

const SettingsControlsReset = (props: Omit<ControlsFooterProps, "visible">) => {
  if (!props.contribution.reset || props.contribution.apply) return null;
  return (
    <Button
      size="sm"
      variant="ghost"
      alignSelf="end"
      disabled={props.pending}
      onClick={() => void props.submit(true).catch(() => undefined)}
    >
      Reset to defaults
    </Button>
  );
};

interface ControlsFooterProps {
  visible: boolean;
  contribution: RegisteredControlsRendererContribution;
  pending: boolean;
  submit: (reset: boolean) => Promise<void>;
}
const ControlsFooter = (props: ControlsFooterProps) => {
  return props.visible ? (
    <Flex borderTopWidth="1px" borderColor="border.muted" pl="sm" pr="4xl" py="xs" gap="xs" justifyContent="flex-end">
      {props.contribution.reset || props.contribution.apply ? (
        <Button
          size="xs"
          variant="ghost"
          disabled={props.pending}
          onClick={() => {
            void props.submit(true);
          }}
        >
          Reset
        </Button>
      ) : null}
      {props.contribution.apply ? (
        <Button
          size="xs"
          variant="subtle"
          disabled={props.pending}
          onClick={() => {
            void props.submit(false);
          }}
        >
          Apply
        </Button>
      ) : null}
    </Flex>
  ) : null;
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
