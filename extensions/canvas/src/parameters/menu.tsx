import { Field, Flex, Input, Stack, Text } from "@chakra-ui/react";
import { createWebviewClient } from "@pstdio/sdk/extensions";
import { type Param, ParamEditor } from "@pstdio/ui/param-editor";
import { useContext, useEffect, useRef, useState } from "react";
import type { CanvasItem } from "../canvas-model";
import type { commands } from "../commands";
import { Button } from "../components/themed-primitives";
import { parametersChanged } from "../events";
import { FrameHostContext } from "../frames/frame-loader";
import { shadersChanged } from "../shaders/events";
import type { FrameParameters, Values } from "./model";
import { Playback } from "./playback";
import { editableValues, useMotionReview } from "./review";

interface ParameterEditorProps {
  active: boolean;
  item: CanvasItem;
  parameters: FrameParameters;
  onChange: (values: Values) => void;
  restoreTheme?: (theme: string) => void;
}
interface Version {
  file: string;
  name: string;
  values: Values;
}
const controlParams = (parameters: FrameParameters, values: Values): Param[] =>
  Object.entries(parameters.controls).map(([id, control]) => {
    const base = { id, name: control.label ?? id, description: control.description, defaultValue: values[id] };
    if (control.type === "number")
      return {
        ...base,
        type: "number",
        defaultValue: Number(values[id]),
        min: control.min,
        max: control.max,
        step: control.step,
      };
    if (control.type === "boolean") return { ...base, type: "boolean", defaultValue: Boolean(values[id]) };
    return {
      ...base,
      type: "selection",
      defaultValue: String(values[id]),
      options: control.options.map(({ value, label }) => ({ id: value, name: label })),
    };
  });

const savedVersions = async (host: Parameters<typeof createWebviewClient>[0], item: CanvasItem, shader?: string) => {
  const client = createWebviewClient<typeof commands>(host);
  const result = await client.commands["parameters.versions"]({
    canvas: item.preview.source,
    frame: item.preview.exportName,
  });
  if (result.restored || !shader || item.preview.exportName !== "Compare") return result;
  const compared = await client.commands["compare.read"]({ shader });
  return { ...result, file: compared.version ? `${compared.version}.json` : result.file };
};
export const ParameterEditor = (props: ParameterEditorProps) => {
  const { item, parameters, onChange } = props;
  const host = useContext(FrameHostContext);
  const [values, setValues] = useState(parameters.values);
  const [defaults, setDefaults] = useState(parameters.values);
  const [versions, setVersions] = useState<Version[]>([]);
  const [file, setFile] = useState(item.preview.save?.file);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const dirty = Object.keys(parameters.controls).some((key) => values[key] !== defaults[key]);
  const local = useRef({ dirty, file });
  useEffect(() => {
    local.current = { dirty, file };
  }, [dirty, file]);
  const edits = useRef(0);
  const send = useRef(onChange);
  useEffect(() => {
    send.current = onChange;
  }, [onChange]);
  const target = { canvas: item.preview.source, frame: item.preview.exportName };
  const shader = /^design\/shaders\/([^/]+)\/shader\.canvas\.tsx$/.exec(item.preview.source)?.[1];
  const playback = useMotionReview({
    host,
    item,
    parameters,
    untouched: () => edits.current === 0,
    apply: (next) => {
      setDefaults(next);
      setValues((current) => ({ ...current, ...next }));
      send.current(next);
    },
    restoreTheme: props.restoreTheme,
  });
  useEffect(() => {
    if (!host || !item.preview.save) return;
    let active = true;
    let request = 0;
    const refresh = () => {
      const revision = ++request;
      const generation = edits.current;
      const current = () => active && revision === request;
      void savedVersions(host, item, shader).then(
        (result) => {
          if (!current()) return;
          setVersions(result.versions);
          if (generation !== edits.current) return;
          const selectedFile = local.current.dirty ? local.current.file : result.file;
          const selected = result.versions.find((version) => version.file === selectedFile);
          if (!selected) return;
          setFile(selected.file);
          const next = editableValues(parameters, selected.values);
          setDefaults(next);
          if (local.current.dirty) return;
          setValues((current) => ({ ...current, ...next }));
          send.current(next);
        },
        (error) => {
          if (current()) setError(String(error));
        },
      );
    };
    const client = createWebviewClient<typeof commands>(host);
    const stop = [
      client.events.subscribe(parametersChanged, refresh),
      client.events.subscribe(shadersChanged, refresh),
    ];
    refresh();
    return () => {
      active = false;
      for (const unsubscribe of stop) unsubscribe();
    };
  }, [host, item, parameters, shader]);
  const change = (next: Values) => {
    edits.current += 1;
    setValues((current) => ({ ...current, ...next }));
    onChange(next);
  };
  const choose = (version: Version) => {
    edits.current += 1;
    const next = editableValues(parameters, version.values);
    setFile(version.file);
    setDefaults(next);
    setValues((current) => ({ ...current, ...next }));
    setError("");
    onChange(next);
    if (host)
      void createWebviewClient<typeof commands>(host)
        .commands["parameters.select"]({ ...target, file: version.file })
        .catch((error) => setError(String(error)));
  };
  const manage = async (remove: boolean) => {
    if (!host || !file) return;
    setSaving(true);
    setError("");
    try {
      const client = createWebviewClient<typeof commands>(host);
      if (remove) await client.commands["parameters.delete"]({ ...target, file });
      else await client.commands["parameters.rename"]({ ...target, file, name });
      const result = await client.commands["parameters.versions"](target);
      setVersions(result.versions);
      if (remove) {
        const version = result.versions.find((entry) => entry.file === result.file);
        if (version) choose(version);
      }
      setName("");
    } catch (error) {
      setError(String(error));
    } finally {
      setSaving(false);
    }
  };
  const save = async (newVersion: boolean) => {
    if (!host) return;
    const revision = edits.current;
    setSaving(true);
    setError("");
    try {
      const client = createWebviewClient<typeof commands>(host);
      const selected = Object.fromEntries(
        Object.keys(parameters.controls)
          .filter((key) => Object.hasOwn(values, key))
          .map((key) => [key, values[key]]),
      );
      const result = await client.commands["parameters.save"]({
        ...target,
        file,
        values: selected,
        ...(newVersion ? { name } : {}),
      });
      setFile(result.file);
      setDefaults(result.values);
      setName("");
      if (revision === edits.current) setValues((current) => ({ ...current, ...result.values }));
      setVersions((await client.commands["parameters.versions"](target)).versions);
    } catch (error) {
      setError(String(error));
    } finally {
      setSaving(false);
    }
  };
  // Keep values and clocks alive, but dispose inactive controls and their portaled menus.
  return (
    <Stack gap="md" p="sm">
      {props.active && (
        <Stack gap="md">
          {!!versions.length && (
            <ParamEditor
              params={[
                {
                  id: "version",
                  name: "Version",
                  type: "selection",
                  defaultValue: file ?? "",
                  options: versions.map((version) => ({ id: version.file, name: version.name })),
                  disabled: saving,
                },
              ]}
              onChange={(_id, value) => {
                const version = versions.find((entry) => entry.file === value);
                if (version) choose(version);
              }}
            />
          )}
          <ParamEditor
            params={controlParams(parameters, values)}
            defaultValues={values}
            onChange={(id, value) => {
              if (["string", "number", "boolean"].includes(typeof value)) change({ [id]: value as Values[string] });
            }}
          />
          <Button
            variant="ghost"
            disabled={saving}
            onClick={() => {
              edits.current += 1;
              const reset = Object.fromEntries(Object.keys(parameters.controls).map((key) => [key, defaults[key]]));
              setValues((current) => ({ ...current, ...reset }));
              onChange(reset);
            }}
          >
            Reset parameters
          </Button>
          {item.preview.save && (
            <>
              <Field.Root>
                <Field.Label>Version name</Field.Label>
                <Input size="sm" value={name} onChange={(event) => setName(event.target.value)} />
              </Field.Root>
              <Flex gap="sm" wrap="wrap">
                <Button
                  variant="primary"
                  loading={saving}
                  disabled={!host || !dirty || saving}
                  onClick={() => void save(false)}
                >
                  Save
                </Button>
                <Button disabled={!host || !name.trim() || saving} onClick={() => void save(true)}>
                  Save as new version
                </Button>
              </Flex>
              <Flex gap="sm" wrap="wrap">
                <Button disabled={!host || !name.trim() || saving} onClick={() => void manage(false)}>
                  Rename version
                </Button>
                <Button disabled={!host || file === item.preview.save.file || saving} onClick={() => void manage(true)}>
                  Delete version
                </Button>
              </Flex>
            </>
          )}
          <Text role="status" textStyle="paragraph/S/regular" color="fg.muted">
            {dirty ? "Temporary changes" : "Saved values"}
          </Text>
          {error && (
            <Text role="alert" color="fg.error">
              {error}
            </Text>
          )}
        </Stack>
      )}
      {parameters.motion && (
        <Playback
          name={item.name}
          active={props.active}
          motion={parameters.motion}
          restored={playback}
          onInteraction={() => {
            edits.current += 1;
          }}
          onChange={onChange}
        />
      )}
    </Stack>
  );
};
