import { type BoardViewCreate, type BoardViewUpdate, defineCommand, params } from "@pstdio/sdk/extensions";
import { timelineBoard } from "../../data/ticket-board";

export const readViewsCommand = defineCommand({
  id: "timeline.views.read",
  title: "Read ticket views",
  run: (ctx) => ctx.views.list(timelineBoard),
});

export const createViewCommand = defineCommand({
  id: "timeline.views.create",
  title: "Create ticket view",
  mutating: true,
  params: { value: params.json<BoardViewCreate, { required: true }>({ required: true }) },
  run: (ctx, { value }) => ctx.views.create(timelineBoard, value),
});

export const updateViewCommand = defineCommand({
  id: "timeline.views.update",
  title: "Update ticket view",
  mutating: true,
  params: {
    id: params.text({ required: true }),
    value: params.json<BoardViewUpdate, { required: true }>({ required: true }),
  },
  run: (ctx, { id, value }) => ctx.views.update(timelineBoard, id, value),
});

export const deleteViewCommand = defineCommand({
  id: "timeline.views.delete",
  title: "Delete ticket view",
  mutating: true,
  params: { id: params.text({ required: true }) },
  run: (ctx, { id }) => ctx.views.remove(timelineBoard, id),
});

export const defaultViewCommand = defineCommand({
  id: "timeline.views.default",
  title: "Set default ticket view",
  mutating: true,
  params: { id: params.text() },
  run: (ctx, { id }) => ctx.views.setDefault(timelineBoard, id ?? null),
});
