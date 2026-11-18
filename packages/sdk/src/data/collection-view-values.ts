import type { ViewFieldKind } from "pstdio-api-contracts/extension-kernel";

/** Native group keys and older saved exact-value filters use JavaScript String(value). */
export const scalarViewValues = (kind: ViewFieldKind, keys: string[]) =>
  keys.flatMap<string | number | boolean>((key) => {
    if (kind === "number") return Number.isFinite(Number(key)) && String(Number(key)) === key ? [Number(key)] : [];
    if (kind === "boolean") return key === "true" || key === "false" ? [key === "true"] : [];
    return [key];
  });
