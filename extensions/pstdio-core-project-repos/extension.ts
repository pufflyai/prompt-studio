import { defineExtension, packageAsset } from "@pstdio/sdk/extensions";
import { readProjectRepoDiff } from "./src/project-repo-diff";

export default defineExtension({
  commands: {
    "projectRepos.diff.read": {
      title: "Read project repository changes",
      description: "Read changed files from the project's repository roots.",
      async run(ctx) {
        return readProjectRepoDiff({
          process: ctx.process,
          repos: ctx.repos,
        });
      },
    },
  },

  routes: {
    projectFiles: {
      path: "project-files",
      label: "Project files",
      webview: {
        entry: packageAsset("./src/project-files-page.tsx", import.meta.url),
        capabilities: ["commands.execute"],
      },
    },
  },

  treeItems: {
    projectFiles: {
      target: "workbench.left.tree",
      label: "Project files",
      icon: "Files",
      placement: "first",
      action: { kind: "route", route: "project-files" },
      when: { mode: "project" },
    },
  },
});
