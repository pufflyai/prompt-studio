import { Badge } from "@chakra-ui/react";
import * as React from "react";

export interface NotificationBadgeProps {
  count: number;
  cap?: number;
}

export const NotificationBadge = React.forwardRef<HTMLSpanElement, NotificationBadgeProps>(function NotificationBadge(
  { count, cap = 99 },
  ref,
) {
  if (count <= 0) return null;
  const label = count > cap ? `${cap}+` : String(count);
  return (
    <Badge ref={ref} colorPalette="red" variant="solid" size="xs" px="1.5" data-testid="notification-badge">
      {label}
    </Badge>
  );
});
