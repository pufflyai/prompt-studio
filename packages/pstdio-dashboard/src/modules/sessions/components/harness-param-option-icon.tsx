import { harnessParamOptionColor } from "@pstdio/ui/param-editor";
import { WorkbenchIcon } from "@pstdio/workbench/react";

export const HarnessParamOptionIcon = (props: { name?: string }) => {
  const { name } = props;
  const color = harnessParamOptionColor(name);
  return <WorkbenchIcon name={name} size={14} color={color ? `${color}.500` : undefined} />;
};
