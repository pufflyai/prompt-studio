import type { ShellArea, ShellCore } from "../../core";

export const getHeaderBorderBottomWidth = (shell: ShellCore, area: ShellArea) =>
  shell.layout.getAreaHeaderBorderBottom(area) ? "1px" : "0";
