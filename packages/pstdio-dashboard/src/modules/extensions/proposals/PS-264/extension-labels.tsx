import { Badge, Button, Icon } from "@chakra-ui/react";
import { SearchableMenu, Tooltip } from "@pstdio/ui";
import { ChevronDown, Folder, Globe, LockKeyhole, UserRound } from "lucide-react";
import type { ExtensionPreview } from "./extension-fixtures";

export const visibilityLabels = {
  public: {
    label: "Public",
    icon: Globe,
    description: "A public package is available. Local changes may not be published.",
  },
  private: { label: "Private", icon: LockKeyhole, description: "Unpublished extension." },
};

export const scopeLabels = {
  repo: { label: "This Project", icon: Folder, description: "Available in this project." },
  global: {
    label: "All Projects",
    icon: UserRound,
    description: "Available across projects on this computer.",
  },
};

interface ExtensionLabelProps {
  extension: ExtensionPreview;
  kind: "visibility" | "scope";
}

export const ExtensionLabel = (props: ExtensionLabelProps) => {
  const { extension, kind } = props;
  const info = kind === "visibility" ? visibilityLabels[extension.visibility] : scopeLabels[extension.scope];
  return (
    <Tooltip content={info.description}>
      <Badge variant="chip" size="sm" tabIndex={0} aria-label={`${kind}: ${info.label}. ${info.description}`}>
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
