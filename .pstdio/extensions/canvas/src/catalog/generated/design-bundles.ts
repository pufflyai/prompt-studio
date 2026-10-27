export const designBundles = {
  "design-system": () => import("./design-system-design").then((module) => module.default),
  website: () => import("./website-design").then((module) => module.default),
  autobuilder: () => import("./autobuilder-design").then((module) => module.default),
  "social-radar": () => import("./social-radar-design").then((module) => module.default),
};
