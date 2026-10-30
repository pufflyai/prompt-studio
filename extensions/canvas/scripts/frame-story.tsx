import { Box, Text } from "@chakra-ui/react";
import { type ComponentType, useState } from "react";

export interface LoadedStory {
  Component: ComponentType<Record<string, unknown>>;
  args?: Record<string, unknown>;
  argTypes?: Record<string, unknown>;
  parameters?: Record<string, unknown>;
  dispose?: () => void;
  timings?: Record<string, number>;
}
export const inspect = (value: unknown) => {
  const seen = new WeakSet<object>();
  return JSON.stringify(
    value,
    (_key, item) => {
      if (typeof item === "function") return `[callback ${item.name || "local"}]`;
      if (typeof item === "bigint" || typeof item === "symbol") return String(item);
      if (item && typeof item === "object") {
        if (seen.has(item)) return "[shared reference]";
        seen.add(item);
      }
      return item;
    },
    2,
  );
};
export const FrameStory = (props: { loaded: LoadedStory; minimumHeight: number }) => {
  const { loaded, minimumHeight } = props;
  const [args, setArgs] = useState(loaded.args ?? {});
  const [closed, setClosed] = useState(false);
  const update = (change: Record<string, unknown>) => setArgs((current) => ({ ...current, ...change }));
  const callbacks: Record<string, (...values: any[]) => unknown> = {};
  const connect = (name: string, apply: (...values: any[]) => unknown) => {
    callbacks[name] = async (...values) => {
      const original = args[name];
      const result = typeof original === "function" ? await original(...values) : undefined;
      if (result !== false) apply(...values);
      return result ?? true;
    };
  };
  // Controlled example props have a local owner in each preview.
  if ("value" in args) {
    callbacks.onChange = (event) => {
      const original = args.onChange;
      if (typeof original === "function") original(event);
      update({ value: event?.target?.value ?? event });
    };
    callbacks.onValueChange = (value) => {
      const original = args.onValueChange;
      if (typeof original === "function") original(value);
      update({ value: value?.value ?? value });
    };
  }
  if ("checked" in args) callbacks.onCheckedChange = (value) => update({ checked: value?.checked ?? value });
  if ("open" in args) callbacks.onOpenChange = (value) => update({ open: value?.open ?? value });
  if ("onClose" in args)
    connect("onClose", () => {
      if ("open" in args) update({ open: false });
      else setClosed(true);
    });
  if ("enabled" in args) {
    connect("onPause", () => update({ enabled: false, paused: true }));
    connect("onResume", () => update({ enabled: true, paused: false }));
    connect("onStop", () => update({ enabled: false, paused: false, running: 0, sessions: [], supervisor: null }));
  }
  if ("currentPath" in args && Array.isArray(args.entries)) {
    connect("onNavigate", (currentPath: string) => update({ currentPath }));
    connect("onCreateFolder", (name: string) =>
      update({
        entries: [
          ...(args.entries as unknown[]),
          { name, path: `${String(args.currentPath).replace(/\/$/, "")}/${name}`, isDirectory: true },
        ],
      }),
    );
    connect("onSelect", () => setClosed(true));
  }
  const Story = loaded.Component;
  return (
    <Box display="grid" minH={minimumHeight ? `${minimumHeight}px` : undefined} data-preview-content>
      {closed ? (
        <Text p="md" role="status">
          Example closed. Reset the frame to try it again.
        </Text>
      ) : (
        <Story {...args} {...callbacks} />
      )}
    </Box>
  );
};
