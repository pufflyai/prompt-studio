import { mergeRefs } from "@chakra-ui/react";
import {
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
  type Ref,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import { TooltipPresence } from "@/utils/scoped-tooltip";
import { Tooltip, type TooltipProps } from "../primitives/tooltip";

const triggerCaption = (element: HTMLElement) => {
  const text = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const parts: string[] = [];
  while (text.nextNode()) {
    const excluded = text.currentNode.parentElement?.closest('[aria-hidden="true"], [hidden], svg, style, script');
    if (!excluded || !element.contains(excluded)) parts.push(text.currentNode.textContent ?? "");
  }
  return parts.join(" ").replace(/\s+/g, " ").trim();
};

/** Reveal clipped dropdown captions without replacing a caller's explicit tooltip. */
export const TriggerTooltip = (props: {
  children: ReactElement<{ ref?: Ref<HTMLElement>; children?: ReactNode }>;
  disabled: boolean;
}) => {
  const { children, disabled } = props;
  const explicitTooltip = useContext(TooltipPresence);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [caption, setCaption] = useState({ text: "", id: undefined as string | undefined });
  const childRef = children.props.ref;
  const mergedRef = useMemo(() => mergeRefs(childRef, setAnchor), [childRef]);
  const overflowRef = useMemo(() => ({ current: anchor }), [anchor]);

  useLayoutEffect(() => {
    if (!anchor || explicitTooltip) return;
    const refresh = () => {
      const text = triggerCaption(anchor);
      const id = anchor.id || undefined;
      setCaption((current) => (current.text === text && current.id === id ? current : { text, id }));
    };
    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(anchor, {
      childList: true,
      characterData: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["id", "aria-hidden", "hidden"],
    });
    return () => observer.disconnect();
  }, [anchor, explicitTooltip]);

  if (explicitTooltip) return children;
  const supplied = children.props.children;
  if (isValidElement<TooltipProps>(supplied) && supplied.type === Tooltip) {
    // The provider must surround the real trigger so both overlays receive its events and DOM ref.
    return cloneElement(supplied, {
      ids: { trigger: caption.id, ...supplied.props.ids },
      children: cloneElement(children, { ref: mergedRef, children: supplied.props.children }),
    });
  }
  return (
    <Tooltip content={caption.text} overflowRef={overflowRef} disabled={disabled} ids={{ trigger: caption.id }}>
      {cloneElement(children, { ref: mergedRef })}
    </Tooltip>
  );
};
