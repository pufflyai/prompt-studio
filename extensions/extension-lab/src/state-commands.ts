import { defineCommand, eventRef, l10n, params } from "@pstdio/sdk/extensions";
import { readExampleState, writeExampleState } from "./example-state";
import type { StateChange } from "./state-changes";
import { type ExampleName, exampleNames, exampleResources } from "./state-defaults";

export const examplesChanged = eventRef<{ name: string }>({
  extensionId: "pstdio.extension-lab",
  id: "examples.changed",
});
const nameParam = () =>
  params.select({ required: true, options: exampleNames.map((value) => ({ value, label: value })) });
const exampleName = (name: string) => {
  if (!exampleNames.includes(name as ExampleName)) throw new Error(`Unknown example: ${name}`);
  return name as ExampleName;
};
export const readState = defineCommand({
  id: "state.read",
  title: l10n("commands.stateRead", "Read example"),
  cli: { path: ["state", "read"] },
  params: { name: nameParam() },
  async run(ctx, input) {
    const name = exampleName(input.name);
    return { name, state: await readExampleState(ctx.storage, name) };
  },
});
export const updateState = defineCommand({
  id: "state.update",
  title: l10n("commands.stateUpdate", "Update example"),
  cli: { path: ["state", "update"] },
  params: { name: nameParam(), changes: params.json<StateChange[], { required: true }>({ required: true }) },
  async run(ctx, input) {
    const name = exampleName(input.name);
    const state = await writeExampleState(ctx.storage, name, input.changes);
    await ctx.events.emit(examplesChanged, { name });
    return { name, state };
  },
});
export const queryResources = defineCommand({
  id: "resources.query",
  title: l10n("commands.resourcesQuery", "List example resources"),
  cli: { path: ["resources", "list"] },
  params: { name: nameParam() },
  async run(ctx, input) {
    const name = exampleName(input.name);
    if (name === "scribble") {
      const state = await readExampleState(ctx.storage, "scribble");
      return state.documents.map((doc) => ({ type: "scribble.document", id: doc.id, label: doc.title }));
    }
    if (name === "pigeon") {
      const state = await readExampleState(ctx.storage, "pigeon");
      return [
        ...exampleResources.pigeon,
        ...state.sent.map((message) => ({ type: "pigeon.thread", id: message.id, label: message.subject })),
      ];
    }
    return exampleResources[name];
  },
});
export const commands = { "state.read": readState, "state.update": updateState, "resources.query": queryResources };
