import { Icon, Menu, Portal } from "@chakra-ui/react";
import { ListRow } from "@pstdio/ui";
import { Plus, ShieldCheck } from "lucide-react";
import type { CreateContext } from "./ticket-form";
export interface BackgroundContext extends CreateContext {
  x: number;
  y: number;
}
interface BackgroundMenuProps {
  context: BackgroundContext;
  onCreate: (kind: "ticket" | "gate", context: CreateContext) => void;
  onClose: () => void;
}
export function BackgroundMenu(props: BackgroundMenuProps) {
  const { context, onCreate, onClose } = props;
  return (
    <Menu.Root
      open
      positioning={{
        strategy: "fixed",
        placement: "bottom-start",
        getAnchorRect: () => ({ x: context.x, y: context.y, width: 0, height: 0 }),
      }}
      onOpenChange={({ open }) => {
        if (!open) onClose();
      }}
    >
      <Portal>
        <Menu.Positioner>
          <Menu.Content>
            <Menu.Item value="ticket" asChild>
              <ListRow
                asChild
                variant="full-width"
                label="Create ticket"
                icon={<Icon as={Plus} />}
                onActivate={() => onCreate("ticket", context)}
              />
            </Menu.Item>
            <Menu.Item value="gate" asChild>
              <ListRow
                asChild
                variant="full-width"
                label="Add agent gate"
                icon={<Icon as={ShieldCheck} />}
                onActivate={() => onCreate("gate", context)}
              />
            </Menu.Item>
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
}
