import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  type OnboardingState,
  onboardingExtensions,
  onboardingStateSchema,
  type UpdateOnboarding,
} from "pstdio-api-contracts";

export const createOnboarding = (input: { path: string; enqueue: (installName: string) => void }) => {
  const read = async () => {
    try {
      return onboardingStateSchema.parse(JSON.parse(await readFile(input.path, "utf8")));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      return { completed: false, hidden: false, harnesses: null, workAreas: null } satisfies OnboardingState;
    }
  };
  const save = async (state: OnboardingState) => {
    await mkdir(dirname(input.path), { recursive: true });
    const temporary = `${input.path}.${crypto.randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify(state));
    await rename(temporary, input.path);
  };
  let pending: Promise<unknown> = Promise.resolve();
  const update = (request: UpdateOnboarding) => {
    const operation = pending.then(async () => {
      const current = await read();
      let state: OnboardingState;
      let extensions: string[] = [];
      if (request.step === "harnesses") {
        const selected = [...new Set(request.harnesses)];
        state = { ...current, harnesses: selected };
        extensions = selected.map((id) => `harness-${id}`);
      } else if (request.step === "complete") {
        const selected = [...new Set(request.workAreas)];
        state = { ...current, completed: true, workAreas: selected };
        extensions = onboardingExtensions(selected);
      } else if (request.step === "skip") {
        state = { ...current, completed: true };
      } else {
        state = { ...current, hidden: request.hidden };
      }
      await save(state);
      for (const name of extensions) input.enqueue(name);
      return state;
    });
    pending = operation.catch(() => {});
    return operation;
  };
  const resume = async () => {
    const state = await read();
    for (const id of state.harnesses ?? []) input.enqueue(`harness-${id}`);
    if (state.completed && state.workAreas) {
      for (const name of onboardingExtensions(state.workAreas)) input.enqueue(name);
    }
  };
  return { read, update, resume };
};
