import { isNavigationTarget } from "@pstdio/sdk/extensions";
import { localizableStringSchema } from "pstdio-api-contracts";
import { text } from "pstdio-extensions/workbench";
import { z } from "zod";
import { toWorkbenchNavigationTarget } from "../host/extension-navigation-target";

const common = {
  id: z.string().min(1),
  label: localizableStringSchema,
  icon: z.string().optional(),
  group: z.string().optional(),
  disabled: z.boolean().optional(),
};
const action = z.object({
  ...common,
  selected: z.boolean().optional(),
  action: z.custom<import("@pstdio/sdk/extensions").NavigationTarget>(isNavigationTarget),
});
const snapshot = z.object({
  items: z.array(z.union([action, z.object({ ...common, items: z.array(action) })])),
});

/** Resolve local refs once against the contributing extension, including menu commands. */
export const toActionBarSnapshot = (value: unknown, extensionId: string, projectId: string) => {
  const parsed = snapshot.parse(value);
  const resolveAction = (item: z.infer<typeof action>) => ({
    ...item,
    label: text(item.label, item.id),
    action: toWorkbenchNavigationTarget(item.action, { extensionId, projectId }),
  });
  return {
    items: parsed.items.map((item) =>
      "items" in item
        ? { ...item, label: text(item.label, item.id), items: item.items.map(resolveAction) }
        : resolveAction(item),
    ),
  };
};
export type NativeActionBarSnapshot = ReturnType<typeof toActionBarSnapshot>;
