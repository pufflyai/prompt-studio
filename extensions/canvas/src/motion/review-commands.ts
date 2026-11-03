import { type CommandContext, defineCommand, l10n, params } from "@pstdio/sdk/extensions";
import {
  applyReviewChange,
  initialState,
  playbackPosition,
  type ReviewChange,
  type ReviewState,
  togglePlaybackChange,
} from "./review-state";
import { readStudy } from "./studies";
import { projectFiles, studyCommands } from "./study-commands";
import type { StudyMetadata } from "./study-schema";

const read = async (ctx: CommandContext, study: StudyMetadata) => {
  const stored = await ctx.storage.collection<ReviewState>("reviews").get(study.id);
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
const updateReview = (
  ctx: CommandContext,
  study: string,
  change: (state: ReviewState, study: StudyMetadata) => ReviewChange,
) => {
  const write = writes.then(async () => {
    const result = await readStudy(projectFiles(ctx), study);
    if (!result.ok) throw new Error(`Study "${study}" is ${result.reason}`);
    const state = await read(ctx, result.study);
    const next = applyReviewChange(state, change(state, result.study), Date.now(), result.study.duration);
    await ctx.storage.collection<ReviewState>("reviews").put(study, next);
    return next;
  });
  writes = write.then(
    () => {},
    () => {},
  );
  return write;
};
const readState = defineCommand({
  id: "review.read",
  cli: true,
  title: l10n("review.read", "Read animation review"),
  params: { study: params.text({ required: true }) },
  async run(ctx, input) {
    const result = await readStudy(projectFiles(ctx), input.study);
    if (!result.ok) throw new Error(`Study "${input.study}" is ${result.reason}`);
    const state = await read(ctx, result.study);
    return {
      ...state,
      restored: Boolean(await ctx.storage.collection("reviews").get(input.study)),
    };
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
  run: (ctx, input) => updateReview(ctx, input.study, () => input.change),
});
const playback = defineCommand({
  id: "review.playback",
  title: l10n("review.playback", "Control animation playback"),
  mutating: true,
  params: {
    study: params.text({ required: true }),
    operation: params.select({
      required: true,
      options: [
        { label: "Play or pause", value: "toggle" },
        { label: "Restart", value: "restart" },
      ],
    }),
  },
  run: (ctx, input) =>
    updateReview(ctx, input.study, (state, study) => {
      if (input.operation === "restart") return { frame: 0, playing: false };
      const { frame, playing } = playbackPosition(state, Date.now(), study.duration);
      return togglePlaybackChange(state, frame, playing, study.duration);
    }),
});
export const motionCommands = {
  ...studyCommands,
  "review.read": readState,
  "review.update": updateState,
  "review.playback": playback,
};
