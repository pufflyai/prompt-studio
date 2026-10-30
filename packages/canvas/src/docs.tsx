import { type ComponentType, createElement, useEffect, useState } from "react";
import { type CanvasMeta, type CanvasVariant, composePreview } from "./compose";

export const Meta = (_props: { of?: unknown; title?: string }) => null;
export const Source = (props: { code?: string }) => createElement("pre", null, props.code);
export const Canvas = (props: { of: CanvasVariant; meta?: CanvasMeta }) => {
  const { of, meta } = props;
  const [Preview, setPreview] = useState<ComponentType>();
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    let dispose: (() => void) | undefined;
    composePreview(of, meta)
      .then((preview) => {
        if (!active) return preview.dispose();
        dispose = preview.dispose;
        setPreview(() => preview.Component as ComponentType);
      })
      .catch((error) => {
        if (active) setError(String(error));
      });
    return () => {
      active = false;
      dispose?.();
    };
  }, [of, meta]);
  if (error) return createElement("p", { role: "alert" }, error);
  return Preview ? createElement(Preview) : null;
};
