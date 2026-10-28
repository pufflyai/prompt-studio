import { Button, Menu, Portal } from "@chakra-ui/react";
import { ChevronDown, Tag } from "lucide-react";

interface VersionsMenuProps {
  versions: string[];
  chosen?: string[];
  onChange: (chosen?: string[]) => void;
}

// Picks which releases the time series shows; no choice shows them all.
export const VersionsMenu = (props: VersionsMenuProps) => {
  const { versions, chosen, onChange } = props;
  const shown = chosen ?? versions;
  const label = chosen ? `${shown.length} of ${versions.length} versions` : "All versions";
  const toggle = (version: string) => {
    const next = shown.includes(version) ? shown.filter((entry) => entry !== version) : [...shown, version];
    onChange(next.length === versions.length ? undefined : next);
  };
  return (
    <Menu.Root closeOnSelect={false}>
      <Menu.Trigger asChild>
        <Button size="xs" variant="ghost" aria-label={`Versions: ${label}`}>
          <Tag />
          {label}
          <ChevronDown />
        </Button>
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content>
            <Menu.Item value="all" onClick={() => onChange(undefined)}>
              All versions
            </Menu.Item>
            <Menu.Separator />
            {[...versions].reverse().map((version) => (
              <Menu.CheckboxItem
                key={version}
                value={version}
                checked={shown.includes(version)}
                onCheckedChange={() => toggle(version)}
              >
                {version}
                <Menu.ItemIndicator />
              </Menu.CheckboxItem>
            ))}
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
};
