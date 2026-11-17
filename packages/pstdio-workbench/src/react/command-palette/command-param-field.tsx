import type { CommandParamFieldProps as FormFieldProps } from "@pstdio/ui/command-form";
import type { ReactNode } from "react";
import type { WorkbenchCommandExecutionContext } from "../../core";

export { CommandParamField } from "@pstdio/ui/command-form";

export interface CommandParamFieldProps extends FormFieldProps {
  /** Host constraints for a native harness control. */
  harness?: {
    presentation?: "chat";
    lockIdentity?: boolean;
    preserveSettings?: boolean;
    settingsMode?: "overrides" | "resolved";
  };
  context?: WorkbenchCommandExecutionContext;
}

// Host renderers may supply resource selectors backed by workbench context.
export type CommandParamFieldRenderer = (props: CommandParamFieldProps) => ReactNode;
