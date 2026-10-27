import { defineCommand, defineKeybinding, params } from "./index";

const rename = defineCommand({
  id: "rename",
  title: "Rename",
  params: {
    resource: params.resource({ resourceType: "document", required: true, resolvedFrom: "resource" }),
    title: params.text({ required: true }),
  },
  run: (_ctx, input) => input.resource.id,
});

defineKeybinding({
  id: "rename-document",
  layer: "current",
  key: "R",
  targetScope: "resource",
  action: { kind: "command", target: { command: rename.ref } },
});

const ordinary = defineCommand({
  id: "open",
  title: "Open",
  params: { name: params.text({ required: true }) },
  run: () => {},
});
const empty = defineCommand({ id: "help", title: "Help", run: () => {} });
defineKeybinding({
  id: "open",
  key: "Alt+O",
  action: { kind: "command", target: { command: ordinary.ref, params: { name: "Draft" } } },
});
defineKeybinding({ id: "help", key: "Alt+H", action: { kind: "command", target: { command: empty.ref } } });
defineKeybinding({
  id: "invalid",
  key: "Alt+I",
  action: {
    kind: "command",
    target: {
      command: ordinary.ref,
      // @ts-expect-error bound navigation arguments must stay JSON values
      params: { date: new Date() },
    },
  },
});
