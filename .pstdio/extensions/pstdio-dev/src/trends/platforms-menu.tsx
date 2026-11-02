import { Button, Menu, Portal } from "@chakra-ui/react";
import { ChevronDown, Monitor } from "lucide-react";
import { PLATFORMS, platformLabel } from "../benchmarks/platforms";

interface PlatformsMenuProps {
  chosen: string[];
  onChange: (chosen: string[]) => void;
}

// Picks which platforms the charts draw, one line each. At least one platform stays chosen.
export const PlatformsMenu = (props: PlatformsMenuProps) => {
  const { chosen, onChange } = props;
  const all = PLATFORMS.map((platform) => platform.id);
  let label = `${chosen.length} platforms`;
  if (chosen.length === all.length) label = "All platforms";
  if (chosen.length === 1) label = platformLabel(chosen[0]);
  const toggle = (platform: string) => {
    const next = chosen.includes(platform) ? chosen.filter((entry) => entry !== platform) : [...chosen, platform];
    if (next.length) onChange(all.filter((entry) => next.includes(entry)));
  };
  return (
    <Menu.Root closeOnSelect={false}>
      <Menu.Trigger asChild>
        <Button size="xs" variant="ghost" aria-label={`Platforms: ${label}`}>
          <Monitor />
          {label}
          <ChevronDown />
        </Button>
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content>
            <Menu.Item value="all" onClick={() => onChange(all)}>
              All platforms
            </Menu.Item>
            <Menu.Separator />
            {PLATFORMS.map((platform) => (
              <Menu.CheckboxItem
                key={platform.id}
                value={platform.id}
                checked={chosen.includes(platform.id)}
                onCheckedChange={() => toggle(platform.id)}
              >
                {platform.label}
                <Menu.ItemIndicator />
              </Menu.CheckboxItem>
            ))}
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
};
