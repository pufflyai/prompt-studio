import { createSlotRecipeContext, type HTMLChakraProps } from "@chakra-ui/react";
import { keyframeTimelineRecipe } from "../../theme/recipes/keyframe-timeline";

const { withProvider, withContext } = createSlotRecipeContext({ recipe: keyframeTimelineRecipe });
export const TimelineRoot = withProvider<HTMLDivElement, HTMLChakraProps<"div">>("div", "root");
export const TimelineToolbar = withContext<HTMLDivElement, HTMLChakraProps<"div">>("div", "toolbar");
export const TimelineRow = withContext<HTMLDivElement, HTMLChakraProps<"div">>("div", "row");
export const TimelineLabel = withContext<HTMLButtonElement, HTMLChakraProps<"button">>("button", "label");
export const TimelineLane = withContext<HTMLDivElement, HTMLChakraProps<"div">>("div", "lane");
export const TimelineRuler = withContext<HTMLDivElement, HTMLChakraProps<"div">>("div", "ruler");
export const TimelineTick = withContext<HTMLDivElement, HTMLChakraProps<"div">>("div", "tick");
export const TimelineTicks = withContext<HTMLDivElement, HTMLChakraProps<"div">>("div", "ticks");
export const TimelineKey = withContext<HTMLButtonElement, HTMLChakraProps<"button">>("button", "keyframe");
export const TimelineDiamond = withContext<HTMLSpanElement, HTMLChakraProps<"span">>("span", "diamond");
export const TimelinePlayhead = withContext<HTMLDivElement, HTMLChakraProps<"div">>("div", "playhead");
export const TimelinePlayheadHandle = withContext<HTMLDivElement, HTMLChakraProps<"div">>("div", "playheadHandle");
export const TimelineGroup = withContext<HTMLButtonElement, HTMLChakraProps<"button">>("button", "group");

export const TimelineLoopBand = withContext<HTMLDivElement, HTMLChakraProps<"div">>("div", "loopBand");
export const TimelineLoopHandle = withContext<HTMLDivElement, HTMLChakraProps<"div">>("div", "loopHandle");
