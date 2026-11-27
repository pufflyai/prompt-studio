import type { ExtensionViewRenderContext } from "@pstdio/sdk/extensions";
import { createContext, useContext } from "react";

export type Translate = ExtensionViewRenderContext["t"];

// Without a host, strings fall back to their English defaults with {{name}} filled in.
const fallback: Translate = (_key, defaultValue, args) =>
  Object.entries(args ?? {}).reduce(
    (text, [name, value]) => text.replaceAll(`{{${name}}}`, String(value)),
    defaultValue ?? "",
  );

export const QuotaTranslations = createContext<Translate>(fallback);

export const useT = () => useContext(QuotaTranslations);
