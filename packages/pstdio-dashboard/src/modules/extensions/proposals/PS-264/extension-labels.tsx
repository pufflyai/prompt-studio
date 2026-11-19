import { Badge, Button, Icon } from "@chakra-ui/react";
import { SearchableMenu, Tooltip } from "@pstdio/ui";
import { Blocks, ChevronDown, Folder, Folders, UserRound } from "lucide-react";
import type { ExtensionPreview } from "./extension-fixtures";

export const authorLabels = {
  me: { label: "Me", icon: UserRound },
  "prompt-studio": { label: "Prompt Studio", icon: Blocks },
};

export const scopeLabels = {
  repo: { label: "This Project", icon: Folder, description: "Available in this project." },
  global: {
    label: "All Projects",
    icon: Folders,
    description: "Available across projects on this computer.",
  },
};

interface ExtensionLabelProps {
  extension: ExtensionPreview;
  kind: "author" | "scope";
}

export const ExtensionLabel = (props: ExtensionLabelProps) => {
  const { extension, kind } = props;
  const info = kind === "author" ? authorLabels[extension.author] : scopeLabels[extension.scope];
  const description = kind === "scope" ? scopeLabels[extension.scope].description : undefined;
  return (
    <Tooltip content={description}>
      <Badge variant="chip" size="sm" tabIndex={kind === "scope" ? 0 : undefined} aria-label={`${kind}: ${info.label}`}>
        <Icon as={info.icon} boxSize="3" />
        {info.label}
      </Badge>
    </Tooltip>
  );
};

interface ExtensionFilterProps {
  label: string;
  value: string;
  options: { value: string; label: string; count: number }[];
  onChange: (value: string) => void;
}

export const ExtensionFilter = (props: ExtensionFilterProps) => {
  const { label, value, options, onChange } = props;
  const current = options.find((option) => option.value === value)!;
  return (
    <SearchableMenu
      showSearch={false}
      searchPlaceholder={`Filter ${label.toLowerCase()}`}
      emptyState={null}
      trigger={
        <Button variant="outline" size="xs" aria-label={`${label}: ${current.label}`}>
          {current.label}
          <Icon as={ChevronDown} boxSize="3" />
        </Button>
      }
      items={options.map((option) => ({
        id: option.value,
        label: `${option.label} · ${option.count}`,
        isSelected: option.value === value,
        onSelect: () => onChange(option.value),
      }))}
    />
  );
};
