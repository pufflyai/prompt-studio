import { createContext } from "react";
import type { DataTableSettings } from "@/components/data-table/types";

export const MarkdownTableSettingsContext = createContext<Partial<DataTableSettings> | undefined>(undefined);
