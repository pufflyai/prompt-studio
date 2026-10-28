import { Button, Menu, Portal } from "@chakra-ui/react";
import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

interface SelectMenuProps {
  label: string;
  icon: ReactNode;
  value: string;
  options: { value: string; label: string }[];
  onValueChange: (value: string) => void;
}

// A compact dropdown, like the collection view's display controls.
export const SelectMenu = (props: SelectMenuProps) => {
  const { label, icon, value, options, onValueChange } = props;
  const current = options.find((option) => option.value === value)?.label ?? value;
  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <Button size="xs" variant="ghost" aria-label={`${label}: ${current}`}>
          {icon}
          {current}
          <ChevronDown />
        </Button>
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content>
            <Menu.RadioItemGroup value={value} onValueChange={(details) => onValueChange(details.value)}>
              {options.map((option) => (
                <Menu.RadioItem key={option.value} value={option.value}>
                  {option.label}
                  <Menu.ItemIndicator />
                </Menu.RadioItem>
              ))}
            </Menu.RadioItemGroup>
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
};
