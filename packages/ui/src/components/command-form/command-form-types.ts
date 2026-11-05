// Presentation schema for command forms. Hosts resolve localized labels and command references before rendering.
export interface CommandParamOption {
  label: string;
  value: string;
  icon?: string;
}

export interface CommandParamOptionSource {
  commandId: string;
  valueField: string;
  labelField: string;
  params?: Record<string, unknown>;
}

export interface CommandParamDescriptor {
  type: string;
  label?: string;
  description?: string;
  required?: boolean;
  defaultValue?: unknown;
  options?: CommandParamOption[] | CommandParamOptionSource;
  allowCustomValues?: boolean;
  templateType?: string;
  resourceType?: string;
  /** Workspace provider ids a `workspace` param may offer. */
  providers?: string[];
  accept?: string;
  multiple?: boolean;
  metadata?: Record<string, unknown>;
  resolvedFrom?: "resource";
}

export type CommandParamSchema = Record<string, CommandParamDescriptor>;
