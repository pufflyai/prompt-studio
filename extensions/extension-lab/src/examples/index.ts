import commands from "./commands";
import pigeon from "./pigeon";
import scribble from "./scribble";
import zipline from "./zipline";

export const pageExamples = {
  commands: commands.commands,
  resourceKinds: [
    ...commands.resourceKinds,
    ...scribble.resourceKinds,
    ...zipline.resourceKinds,
    ...pigeon.resourceKinds,
  ],
  views: [...scribble.views, ...zipline.views, ...pigeon.views],
  pages: [...scribble.pages, ...zipline.pages, ...pigeon.pages],
  navigationItems: [...scribble.navigationItems, ...zipline.navigationItems, ...pigeon.navigationItems],
  navigationTrees: scribble.navigationTrees,
};
