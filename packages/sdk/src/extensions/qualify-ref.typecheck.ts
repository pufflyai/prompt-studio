import type { CommandRef } from "./index";
import { qualifyRef } from "./qualify-ref";

declare const local: CommandRef<{ text: string }, { revision: number }>;
const qualified = qualifyRef("acme.notes", local);
const preservesContract: CommandRef<{ text: string }, { revision: number }> = qualified;
void preservesContract;
// @ts-expect-error Provider references retain their command result type.
const wrongResult: CommandRef<{ text: string }, { revision: string }> = qualified;
void wrongResult;
// @ts-expect-error Provider references retain their command parameter type.
const wrongParams: CommandRef<{ text: number }, { revision: number }> = qualified;
void wrongParams;

import { defineCommand } from "./define-command";
import { params } from "./index";

const save = defineCommand({
  id: "save",
  title: "Save",
  params: { text: params.text({ required: true }) },
  run: async (_ctx, input) => ({ text: input.text }),
});
const inferred = qualifyRef("acme.notes", save.ref);
const inferredContract: CommandRef<{ text: string }, { text: string }> = inferred;
void inferredContract;
// @ts-expect-error Actual helper definitions must retain their inferred result through qualification.
const wrongInferredResult: CommandRef<{ text: string }, { revision: number }> = inferred;
void wrongInferredResult;
// @ts-expect-error Actual helper definitions must retain their inferred parameters through qualification.
const wrongInferredParams: CommandRef<{ count: number }, { text: string }> = inferred;
void wrongInferredParams;

import type { NavigationTargetCommand } from "./index";

const noParams = defineCommand({ id: "noop", title: "No parameters", run: () => undefined });
const noParamsTarget: NavigationTargetCommand = { kind: "command", target: { command: noParams.ref } };
void noParamsTarget;
