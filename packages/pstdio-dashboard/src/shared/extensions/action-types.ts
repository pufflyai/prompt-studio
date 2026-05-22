import type { HeaderActionIcon } from "./components/action-icons";

export interface ActionParamDescriptor {
  key: string;
  label: string;
  type: "text" | "longtext" | "select" | "template-select" | "agent" | "repo";
  description?: string;
  required?: boolean;
  defaultValue?: string;
  options?: { value: string; label: string }[];
  templateType?: string;
}

export interface ActionDescriptor {
  key: string;
  label: string;
  targetType: string;
  placement: string;
  icon?: HeaderActionIcon;
  presentation?: "menu-item" | "button" | "icon-button";
  params?: ActionParamDescriptor[];
}

export type ActionParamValue = string | Record<string, string>;
