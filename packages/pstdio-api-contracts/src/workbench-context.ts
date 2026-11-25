import { z } from "zod";

const id = z.string().min(1).max(512);
const label = z.string().max(200);
const position = z.object({ line: z.number().int().positive(), column: z.number().int().positive() });
const resource = z.object({
  type: id,
  id,
  extensionId: id,
  projectId: id,
  label: label.optional(),
  shorthand: label.optional(),
});
const view = z.object({
  instanceId: id,
  viewId: id,
  label: label.optional(),
  resource: resource.optional(),
});
const region = z.enum(["main", "side", "secondary", "sidenav", "overlay"]);
export const workbenchContextSchema = z.object({
  observedAt: z.iso.datetime(),
  project: z.object({ id, label: label.optional() }),
  mode: z.object({ id, label: label.optional() }).optional(),
  main: z.object({
    page: z.object({ id, extensionId: id, label: label.optional() }).optional(),
    resource: resource.optional(),
  }),
  panels: z.array(view.extend({ region })).max(5),
  focus: z.object({ region, instanceId: id.optional(), composer: z.boolean() }).optional(),
  selection: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("unsupported") }),
    z.object({ kind: z.literal("none"), owner: id }),
    z.object({ kind: z.literal("resources"), owner: id, items: z.array(resource).max(100) }),
    z.object({
      kind: z.literal("text"),
      owner: id,
      document: resource,
      documentPath: z.string().max(2048).optional(),
      start: position,
      end: position,
    }),
  ]),
});
export const workbenchOriginSchema = z.object({
  id: z.uuid(),
  deviceId: id.optional(),
  snapshot: workbenchContextSchema,
});
export type WorkbenchContext = z.infer<typeof workbenchContextSchema>;
export type WorkbenchOrigin = z.infer<typeof workbenchOriginSchema>;
