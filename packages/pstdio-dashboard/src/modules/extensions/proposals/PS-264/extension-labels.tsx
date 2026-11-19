import { Badge, Button, Icon, Stack, Text } from "@chakra-ui/react";
import { SearchableMenu, Tooltip } from "@pstdio/ui";
import { ChevronDown, Folder, Globe, LockKeyhole, UserRound } from "lucide-react";
import type { ExtensionPreview } from "./extension-fixtures";

export const visibilityLabels = {
  public: {
    label: "Public",
    icon: Globe,
    description: "A public package is available. Local changes may not be published.",
  },
  private: { label: "Private", icon: LockKeyhole, description: "Local only. This extension has not been published." },
};

export const scopeLabels = {
  repo: { label: "Project", icon: Folder, description: "Installed for this project only." },
  global: {
    label: "User",
    icon: UserRound,
    description: "Shared across your projects on this computer. Enable it separately in each project.",
  },
};

interface ExtensionLabelProps {
  extension: ExtensionPreview;
  kind: "visibility" | "scope";
  showHint?: boolean;
}

export const ExtensionLabel = (props: ExtensionLabelProps) => {
  const { extension, kind, showHint = false } = props;
  const info = kind === "visibility" ? visibilityLabels[extension.visibility] : scopeLabels[extension.scope];
  const hint = kind === "visibility" && extension.visibility === "private" ? "Local only" : undefined;
  const scopeHint = kind === "scope" && extension.scope === "global" ? "Shared locally" : undefined;
  return (
    <Stack gap="2xs" align="start">
      <Tooltip content={info.description}>
        <Badge variant="chip" size="sm" tabIndex={0} aria-label={`${kind}: ${info.label}. ${info.description}`}>
          <Icon as={info.icon} boxSize="3" />
          {info.label}
        </Badge>
      </Tooltip>
      {showHint && (hint || scopeHint) && (
        <Text textStyle="label/XS" color="fg.subtle">
          {hint || scopeHint}
        </Text>
      )}
    </Stack>
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
