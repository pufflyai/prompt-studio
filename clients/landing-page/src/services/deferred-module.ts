import { type ComponentType, createElement, lazy } from "react";

/** Background preloads and first use share one import; a failed preload can retry. */
export const loadOnDemand = <Value>(load: () => Promise<Value>) => {
  let pending: Promise<Value> | undefined;
  return () => {
    pending ??= load().catch((error) => {
      pending = undefined;
      throw error;
    });
    return pending;
  };
};

export const deferredComponent = <Props extends object>(load: () => Promise<{ default: ComponentType<Props> }>) => {
  let loaded: ComponentType<Props>;
  const preload = loadOnDemand(async () => {
    const module = await load();
    loaded = module.default;
    return module;
  });
  const Deferred = lazy(preload);
  // Astro preloads modules at build time so static pages contain visible content.
  const Component = (props: Props) => createElement(typeof window === "undefined" ? loaded : Deferred, props);
  return { Component, preload };
};
