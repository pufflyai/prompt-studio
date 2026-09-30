import { z } from "zod";
export const studyId = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use a kebab-case study id");
const option = z.object({ id: z.string().min(1), name: z.string().min(1) });
const parameter = z
  .object({
    id: z
      .string()
      .min(1)
      .refine((id) => id !== "preset", "preset is reserved"),
    name: z.string().min(1),
    type: z.enum(["selection", "segmented"]),
    description: z.string().optional(),
    options: z.array(option).min(1),
    default: z.object({ left: z.string(), right: z.string() }),
  })
  .superRefine((param, ctx) => {
    for (const side of ["left", "right"] as const)
      if (!param.options.some((option) => option.id === param.default[side]))
        ctx.addIssue({ code: "custom", path: ["default", side], message: "Default must match an option" });
    if (new Set(param.options.map((o) => o.id)).size !== param.options.length)
      ctx.addIssue({ code: "custom", path: ["options"], message: "Option ids must be unique" });
  });
export const canvasSchema = z.union([
  z.enum(["pane", "workbench"]),
  z.object({ width: z.number().positive(), height: z.number().positive() }),
]);
export const studySchema = z
  .object({
    title: z.string().min(1).max(80),
    group: z.string().min(1),
    description: z.string(),
    duration: z.number().positive().max(120),
    canvas: canvasSchema,
    markers: z.array(z.object({ at: z.number().nonnegative(), label: z.string().min(1) })).default([]),
    params: z.array(parameter).default([]),
  })
  .superRefine((study, ctx) => {
    for (const [i, marker] of study.markers.entries())
      if (marker.at >= study.duration || (i > 0 && marker.at < study.markers[i - 1].at))
        ctx.addIssue({
          code: "custom",
          path: ["markers", i, "at"],
          message: "Markers must be sorted and before the end",
        });
    if (new Set(study.params.map((p) => p.id)).size !== study.params.length)
      ctx.addIssue({ code: "custom", path: ["params"], message: "Param ids must be unique" });
  });
export type StudyMetadata = z.infer<typeof studySchema> & { id: string };
