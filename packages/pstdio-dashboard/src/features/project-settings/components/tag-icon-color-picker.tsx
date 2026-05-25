import { getIconComponent, IconColorPicker } from "@pstdio/ui";

import type { TicketStatusColor } from "@/features/ticket-list/types";

interface TagIconColorPickerProps {
  color: TicketStatusColor;
  icon: string | null;
  onColorChange: (color: TicketStatusColor) => void;
  onIconChange: (icon: string | null) => void;
  disabled?: boolean;
}

export { getIconComponent };

export const TagIconColorPicker = (props: TagIconColorPickerProps) => {
  const { color, icon, onColorChange, onIconChange, disabled } = props;

  return (
    <IconColorPicker
      color={color}
      icon={icon}
      onColorChange={(nextColor) => onColorChange(nextColor as TicketStatusColor)}
      onIconChange={onIconChange}
      disabled={disabled}
    />
  );
};
