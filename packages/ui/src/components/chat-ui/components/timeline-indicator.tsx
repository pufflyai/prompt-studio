import { Avatar, Timeline as ChakraTimeline, Span } from "@chakra-ui/react";
import { getIconComponent } from "../utils/get-icon";
import type { Indicator } from "./timeline";

export function IndicatorView(props: { ind?: Indicator }) {
  const { ind } = props;
  if (!ind || ind.type === "none") return null;

  if (ind.type === "icon") {
    const IndicatorIcon = getIconComponent(ind.icon);
    return (
      <ChakraTimeline.Indicator outline="none" border="none" background="bg" color="fg">
        <Span display="inline-flex" alignItems="center">
          <IndicatorIcon size={14} strokeWidth={1} />
        </Span>
      </ChakraTimeline.Indicator>
    );
  }

  return (
    <ChakraTimeline.Indicator>
      <Avatar.Root boxSize="full">
        <Avatar.Image src={ind.src} alt={ind.alt} />
        <Avatar.Fallback background="bg.muted" color="fg.muted" />
      </Avatar.Root>
    </ChakraTimeline.Indicator>
  );
}
