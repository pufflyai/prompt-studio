import { type StudyId, studies } from "@pstdio/motion-studies";
import { defineCommand, type ExtensionStorageApi, l10n, params } from "@pstdio/sdk/extensions";
import { applyReviewChange, initialState, type ReviewChange, type ReviewState } from "./review-state";

const studyParam = () =>
  params.select({ required: true, options: studies.map((study) => ({ value: study.id, label: study.title })) });
const read = async (storage: ExtensionStorageApi, study: StudyId) =>
  (await storage.collection<ReviewState>("reviews").get(study)) ?? initialState(study);
const readState = defineCommand({
  id: "review.read",
  title: l10n("review.read", "Read animation review"),
  params: { study: studyParam() },
  async run(ctx, input) {
    return read(ctx.storage, input.study as StudyId);
  },
});
const updateState = defineCommand({
  id: "review.update",
  title: l10n("review.update", "Update animation review"),
  params: { study: studyParam(), change: params.json<ReviewChange, { required: true }>({ required: true }) },
  async run(ctx, input) {
    const study = input.study as StudyId;
    const current = await read(ctx.storage, study);
    const next = applyReviewChange(current, input.change, Date.now());
    await ctx.storage.collection<ReviewState>("reviews").put(study, next);
    return next;
  },
});
export const commands = { "review.read": readState, "review.update": updateState };
