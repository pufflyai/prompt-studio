export type MenuId = "resources" | "activity" | "properties";
export type MenuSide = "left" | "right" | "bottom";

export const menus: { id: MenuId; title: string; icon: string }[] = [
  { id: "resources", title: "Resources", icon: "FolderTree" },
  { id: "activity", title: "Activity", icon: "Activity" },
  { id: "properties", title: "Properties", icon: "SlidersHorizontal" },
];
export const sides: MenuSide[] = ["left", "right", "bottom"];

interface MenuLayout {
  menuPositions: Record<MenuId, MenuSide>;
  activeMenus: Partial<Record<MenuSide, MenuId>>;
  focusedMenu?: MenuId;
}
export interface MenuState extends MenuLayout {
  menuPolicy: "single" | "multiple";
}

export const menuLayout = (layout: "split" | MenuSide, policy: MenuState["menuPolicy"] = "single"): MenuLayout => {
  if (layout === "split")
    return {
      menuPositions: { resources: "left", activity: "bottom", properties: "right" },
      activeMenus:
        policy === "multiple" ? { left: "resources", right: "properties", bottom: "activity" } : { left: "resources" },
      focusedMenu: "resources",
    };
  return {
    menuPositions: { resources: layout, activity: layout, properties: layout },
    activeMenus: { [layout]: "resources" },
    focusedMenu: "resources",
  };
};

export const selectMenu = (state: MenuState, id: MenuId, toggle = false) => {
  const side = state.menuPositions[id];
  const active = toggle && state.activeMenus[side] === id;
  const activeMenus = state.menuPolicy === "single" ? {} : { ...state.activeMenus };
  return { activeMenus: { ...activeMenus, [side]: active ? undefined : id }, focusedMenu: active ? undefined : id };
};

export const moveMenu = (state: MenuState, id: MenuId, side: MenuSide): MenuState => {
  const previous = state.menuPositions[id];
  const activeMenus = state.menuPolicy === "single" ? {} : { ...state.activeMenus };
  if (activeMenus[previous] === id) activeMenus[previous] = undefined;
  activeMenus[side] = id;
  return { ...state, menuPositions: { ...state.menuPositions, [id]: side }, activeMenus, focusedMenu: id };
};
