import { Menu, mergeRefs } from "@chakra-ui/react";
import { forwardRef } from "react";

const observeContent = (content: HTMLDivElement | null) => {
  if (!content) return;
  const reveal = () => {
    const id = content.getAttribute("aria-activedescendant");
    const item = id ? content.ownerDocument.getElementById(id) : null;
    const viewport = item?.closest('[data-scope="scroll-area"][data-part="viewport"]');
    if (item && viewport && content.contains(viewport)) item.scrollIntoView({ block: "nearest", inline: "nearest" });
  };
  // Zag currently skips nested scroll owners. See ADR 0155 for removal criteria.
  const observer = new MutationObserver(reveal);
  observer.observe(content, { attributes: true, attributeFilter: ["aria-activedescendant"] });
  reveal();
  return () => observer.disconnect();
};

/** Reveal keyboard choices when ScrollArea, rather than Menu.Content, owns scrolling. */
export const MenuContent = forwardRef<HTMLDivElement, Menu.ContentProps>((props, ref) => (
  <Menu.Content {...props} ref={mergeRefs(ref, observeContent)} />
));
