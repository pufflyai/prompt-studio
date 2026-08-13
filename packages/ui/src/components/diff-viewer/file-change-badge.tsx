import { Badge } from "@chakra-ui/react";

const changeLabels: Record<string, string> = {
  added: "A",
  copied: "C",
  deleted: "D",
  modified: "M",
  permissionChange: "M",
  renamed: "R",
};

const changeColors: Record<string, string> = {
  added: "green",
  copied: "purple",
  deleted: "red",
  modified: "blue",
  permissionChange: "yellow",
  renamed: "orange",
};

const changeSemanticStyles: Record<string, { color: string; backgroundColor: string }> = {
  added: { color: "fg.success", backgroundColor: "bg.success" },
  deleted: { color: "fg.error", backgroundColor: "bg.error" },
};

export const FileChangeBadge = (props: { change: string }) => {
  const { change } = props;
  const colorProps = changeSemanticStyles[change] ?? { colorPalette: changeColors[change] ?? "gray" };

  return (
    <Badge size="xs" variant="subtle" flexShrink={0} {...colorProps}>
      {changeLabels[change] ?? change}
    </Badge>
  );
};
