import { AttachedMenu } from "@pstdio/ui";
import { ResourceMenuContent, type ResourceMenuContentProps } from "./resource-menu-content";
import type { MenuSide } from "./resource-menu-state";

interface ResourceMenuGroupProps extends Omit<ResourceMenuContentProps, "menu"> {
  side: MenuSide;
}

// Menu selection belongs to the single movable menu header. Menu surfaces contain content only.
export const ResourceMenuGroup = (props: ResourceMenuGroupProps) => {
  const { side, state, ...content } = props;
  const selected = state.activeMenus[side];
  if (!selected) return null;
  return (
    <AttachedMenu aria-label={`${content.ticket.id} ${side} menus`}>
      <ResourceMenuContent {...content} state={state} menu={selected} />
    </AttachedMenu>
  );
};
