import { defineCommand, type ExtensionStorageApi, l10n, params } from "@pstdio/sdk/extensions";
import { applyReviewChange, initialState, type ReviewChange, type ReviewState } from "./review-state";
import { readStudy } from "./studies";
import { projectFiles, studyCommands } from "./study-commands";
import type { StudyMetadata } from "./study-schema";

const read = async (storage: ExtensionStorageApi, study: StudyMetadata) => {
  const stored = await storage.collection<ReviewState>("reviews").get(study.id);
  const state = stored?.settings.left.values && stored?.settings.right.values ? stored : initialState(study);
  const settings = { ...state.settings };
  for (const side of ["left", "right"] as const) {
    settings[side] = {
      ...settings[side],
      values: Object.fromEntries(
        study.params.map((param) => {
          const saved = settings[side].values[param.id];
          return [param.id, param.options.some((option) => option.id === saved) ? saved : param.default[side]];
        }),
      ),
    };
  }
  return applyReviewChange({ ...state, settings }, {}, Date.now(), study.duration);
};
let writes = Promise.resolve();
const readState = defineCommand({
  id: "review.read",
  cli: true,
  title: l10n("review.read", "Read animation review"),
  params: { study: params.text({ required: true }) },
  async run(ctx, input) {
    const result = await readStudy(projectFiles(ctx), input.study);
    if (!result.ok) throw new Error(`Study "${input.study}" is ${result.reason}`);
    return read(ctx.storage, result.study);
  },
});
const updateState = defineCommand({
  id: "review.update",
  cli: true,
  mutating: true,
  title: l10n("review.update", "Update animation review"),
  params: {
    study: params.text({ required: true }),
    change: params.json<ReviewChange, { required: true }>({ required: true }),
  },
  async run(ctx, input) {
    const write = writes.then(async () => {
      const result = await readStudy(projectFiles(ctx), input.study);
      if (!result.ok) throw new Error(`Study "${input.study}" is ${result.reason}`);
      const next = applyReviewChange(
        await read(ctx.storage, result.study),
        input.change,
        Date.now(),
        result.study.duration,
      );
      await ctx.storage.collection<ReviewState>("reviews").put(input.study, next);
      return next;
    });
    writes = write.then(
      () => {},
      () => {},
    );
    return write;
  },
});
export const commands = { ...studyCommands, "review.read": readState, "review.update": updateState };
