import { useEffect, useReducer } from "react";

import type { AttributeDescriptor, EnumOptionsSource } from "./types";
import { isEnumOptionsSource } from "./types";

const collectSources = (attributes: AttributeDescriptor[]): EnumOptionsSource[] => {
  const sources: EnumOptionsSource[] = [];
  for (const attribute of attributes) {
    if (attribute.type.kind !== "enum" && attribute.type.kind !== "enum-multi") continue;
    if (isEnumOptionsSource(attribute.type.options)) sources.push(attribute.type.options);
  }
  return sources;
};

/**
 * Returns the same descriptors with every source-backed enum's options
 * replaced by a fresh `getSnapshot()` array. Pure — call from anywhere that
 * needs a normalized view of the schema.
 */
export const resolveAttributeOptions = (attributes: AttributeDescriptor[]): AttributeDescriptor[] =>
  attributes.map((attribute) => {
    if (attribute.type.kind !== "enum" && attribute.type.kind !== "enum-multi") return attribute;
    if (!isEnumOptionsSource(attribute.type.options)) return attribute;
    return { ...attribute, type: { ...attribute.type, options: attribute.type.options.getSnapshot() } };
  });

/**
 * Subscribes to every source-backed enum in `attributes` and returns the
 * resolved descriptors (options materialized to plain arrays). When any
 * source's listener fires the component rerenders, so downstream renders see
 * the new snapshot automatically.
 */
export const useResolvedAttributes = (attributes: AttributeDescriptor[]) => {
  const [, forceRender] = useReducer((tick: number) => tick + 1, 0);

  useEffect(() => {
    const sources = collectSources(attributes);
    if (sources.length === 0) return;
    const refresh = () => forceRender();
    const unsubscribes = sources.map((source) => source.subscribe(refresh));
    return () => {
      for (const dispose of unsubscribes) dispose();
    };
  }, [attributes]);

  return resolveAttributeOptions(attributes);
};
