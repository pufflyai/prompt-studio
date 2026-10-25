import { z } from "zod";
import { localizableStringSchema } from "./common";

export const createPagePlaceholderBreadcrumbSchema = <Action extends z.ZodType>(action: Action) =>
  z
    .object({
      label: localizableStringSchema.optional(),
      icon: z.string().optional(),
      menu: z
        .array(
          z
            .object({
              id: z.string(),
              label: localizableStringSchema.optional(),
              rows: z.array(
                z
                  .object({
                    id: z.string(),
                    label: localizableStringSchema,
                    icon: z.string().optional(),
                    iconColor: z.string().optional(),
                    selected: z.boolean().optional(),
                    disabled: z.boolean().optional(),
                    action: action.optional(),
                  })
                  .strict(),
              ),
            })
            .strict(),
        )
        .optional(),
    })
    .strict();
