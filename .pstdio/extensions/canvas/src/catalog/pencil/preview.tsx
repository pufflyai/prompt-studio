import { Text } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { designBundles } from "../generated/design-bundles";
import fonts from "../generated/fonts-design";
import { PencilDesign } from "./design";
import type { DesignDocument } from "./model";

const cache = new Map<string, Promise<DesignDocument>>();
const unpack = async <T,>(packed: string) => {
  const bytes = Uint8Array.from(atob(packed), (character) => character.charCodeAt(0));
  return new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))).json() as Promise<T>;
};
let fontData: Promise<{ fonts: string }> | undefined;
export const loadDesignDocument = (file: string) => {
  let pending = cache.get(file);
  if (!pending) {
    fontData ??= unpack<{ fonts: string }>(fonts);
    pending = Promise.all([
      designBundles[file as keyof typeof designBundles]().then((packed) => unpack<DesignDocument>(packed)),
      fontData,
    ]).then(([document, fonts]) => ({ ...document, ...fonts }));
    cache.set(file, pending);
  }
  return pending;
};
export const PencilPreview = (props: { file: string; rootId: string }) => {
  const { file, rootId } = props;
  const [document, setDocument] = useState<DesignDocument>();
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    loadDesignDocument(file)
      .then((document) => {
        if (active) setDocument(document);
      })
      .catch((error) => {
        if (active) setError(String(error));
      });
    return () => {
      active = false;
    };
  }, [file]);
  if (error)
    return (
      <Text role="alert" p="md" color="fg.error">
        {error}
      </Text>
    );
  if (!document)
    return (
      <Text p="md" data-ui-canvas-loading>
        Loading design…
      </Text>
    );
  return <PencilDesign document={document} rootId={rootId} />;
};
