import { buildCliHelpTree, type CliHelpNode, checkExtensions, type ExtensionRuntime } from "pstdio-extensions";
import { buildCliCollisionsReport, type CliCollisionsReport } from "./collisions";
import { getStaticCommandNames } from "./static-commands";

export type LoadedCliTree = {
  tree: CliHelpNode[];
  runtime: ExtensionRuntime;
  collisions: CliCollisionsReport;
  staticNames: Set<string>;
};

const filterBlockedNamespaces = (tree: CliHelpNode[], blockedNamespaces: Set<string>) =>
  tree.filter((root) => !blockedNamespaces.has(root.segment));

export const buildLoadedCliTree = (runtime: ExtensionRuntime, staticNames: Set<string>): LoadedCliTree => {
  const collisions = buildCliCollisionsReport(runtime, staticNames);
  const fullTree = buildCliHelpTree(runtime);
  const tree = filterBlockedNamespaces(fullTree, collisions.blockedNamespaces);
  return { tree, runtime, collisions, staticNames };
};

export const loadExtensionCliTree = async (): Promise<LoadedCliTree> => {
  const result = await checkExtensions({});
  return buildLoadedCliTree(result.runtime, getStaticCommandNames());
};
