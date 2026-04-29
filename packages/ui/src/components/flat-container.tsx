import { Box, type BoxProps } from "@chakra-ui/react";
import * as React from "react";

export type FlatContainerVariant = "bottom-right" | "around" | "hover";
export type FlatContainerShadowPatternDensity = "loose" | "mid" | "dense";
export type FlatContainerBorderExtension = "static" | "extend-on-hover" | "retract-on-hover";

export interface FlatContainerProps extends Omit<BoxProps, "shadowColor" | "variant"> {
  borderExtension?: FlatContainerBorderExtension;
  shadowPatternDensity?: FlatContainerShadowPatternDensity;
  shadowColor?: BoxProps["backgroundColor"];
  variant?: FlatContainerVariant;
}

interface FlatContainerBorderProps {
  borderColor: BoxProps["borderColor"];
  extension: string;
  borderStyle: BoxProps["borderStyle"];
  borderWidth: BoxProps["borderWidth"];
}

interface FlatContainerHoverStylesProps {
  borderExtensionHover?: string;
  isHoverVariant: boolean;
}

const extendedBorderExtension = "4px";
const retractedBorderExtension = "0px";
const shadowOffset = "2px";
const shadowPatternMaskImage = `url("data:image/svg+xml,%3Csvg width='6' height='6' viewBox='0 0 6 6' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath fill='black' d='M5 0h1L0 6V5zM6 5v1H5z'/%3E%3C/svg%3E")`;
const negativeBorderExtensionVariable = "calc(var(--flat-container-border-extension) * -1)";
const borderExtensionTransition = [
  "inset-block-start 160ms ease-in-out",
  "inset-block-end 160ms ease-in-out",
  "inset-inline-start 160ms ease-in-out",
  "inset-inline-end 160ms ease-in-out",
].join(", ");

const borderExtensionStates: Record<FlatContainerBorderExtension, { initial: string; hover?: string }> = {
  static: {
    initial: extendedBorderExtension,
  },
  "extend-on-hover": {
    initial: retractedBorderExtension,
    hover: extendedBorderExtension,
  },
  "retract-on-hover": {
    initial: extendedBorderExtension,
    hover: retractedBorderExtension,
  },
};

const shadowPatternSizes: Record<FlatContainerShadowPatternDensity, string> = {
  loose: "8px 8px",
  mid: "5px 5px",
  dense: "4px 4px",
};

const shadowPlacementStyles: Record<FlatContainerVariant, BoxProps> = {
  "bottom-right": {
    insetBlockEnd: `-${shadowOffset}`,
    insetBlockStart: shadowOffset,
    insetInlineEnd: `-${shadowOffset}`,
    insetInlineStart: shadowOffset,
  },
  around: {
    inset: `-${shadowOffset}`,
  },
  hover: {
    inset: "0",
    transform: "translate(var(--flat-container-shadow-offset), var(--flat-container-shadow-offset))",
  },
};

function getFlatContainerHoverStyles(props: FlatContainerHoverStylesProps) {
  const { borderExtensionHover, isHoverVariant } = props;
  const hoverStyles: NonNullable<BoxProps["_hover"]> = {};

  if (borderExtensionHover !== undefined) {
    Object.assign(hoverStyles, {
      "& [data-flat-container-border]": {
        "--flat-container-border-extension": borderExtensionHover,
      },
    });
  }

  if (isHoverVariant) {
    Object.assign(hoverStyles, {
      "& [data-flat-container-shadow]": {
        "--flat-container-shadow-offset": shadowOffset,
        opacity: 1,
      },
    });
  }

  if (Object.keys(hoverStyles).length === 0) {
    return undefined;
  }

  return hoverStyles;
}

function FlatContainerBorder(props: FlatContainerBorderProps) {
  const { borderColor, extension, borderStyle, borderWidth } = props;

  return (
    <Box
      aria-hidden="true"
      data-flat-container-border=""
      inset="0"
      pointerEvents="none"
      position="absolute"
      css={{
        "--flat-container-border-extension": extension,
      }}
    >
      <Box
        borderBlockStartWidth={borderWidth}
        borderColor={borderColor}
        borderStyle={borderStyle}
        height="0"
        insetBlockStart="0"
        insetInlineEnd={negativeBorderExtensionVariable}
        insetInlineStart={negativeBorderExtensionVariable}
        position="absolute"
        transition={borderExtensionTransition}
      />
      <Box
        borderBlockEndWidth={borderWidth}
        borderColor={borderColor}
        borderStyle={borderStyle}
        height="0"
        insetBlockEnd="0"
        insetInlineEnd={negativeBorderExtensionVariable}
        insetInlineStart={negativeBorderExtensionVariable}
        position="absolute"
        transition={borderExtensionTransition}
      />
      <Box
        borderInlineStartWidth={borderWidth}
        borderColor={borderColor}
        borderStyle={borderStyle}
        insetBlockEnd={negativeBorderExtensionVariable}
        insetBlockStart={negativeBorderExtensionVariable}
        insetInlineStart="0"
        position="absolute"
        transition={borderExtensionTransition}
        width="0"
      />
      <Box
        borderInlineEndWidth={borderWidth}
        borderColor={borderColor}
        borderStyle={borderStyle}
        insetBlockEnd={negativeBorderExtensionVariable}
        insetBlockStart={negativeBorderExtensionVariable}
        insetInlineEnd="0"
        position="absolute"
        transition={borderExtensionTransition}
        width="0"
      />
    </Box>
  );
}

export const FlatContainer = React.forwardRef<HTMLDivElement, FlatContainerProps>(function FlatContainer(props, ref) {
  const {
    variant = "bottom-right",
    borderColor = "border.muted",
    borderExtension = "static",
    borderStyle = "solid",
    borderWidth = "1px",
    children,
    shadowColor = "border",
    shadowPatternDensity = "mid",
    ...rest
  } = props;
  const isHoverVariant = variant === "hover";
  const borderExtensionState = borderExtensionStates[borderExtension];
  const hoverStyles = getFlatContainerHoverStyles({
    borderExtensionHover: borderExtensionState.hover,
    isHoverVariant,
  });
  const shadowPatternSize = shadowPatternSizes[shadowPatternDensity];

  return (
    <Box isolation="isolate" position="relative" width="full" _hover={hoverStyles}>
      <Box
        aria-hidden="true"
        backgroundColor={shadowColor}
        data-flat-container-shadow=""
        opacity={isHoverVariant ? 0 : 1}
        pointerEvents="none"
        position="absolute"
        transition="opacity 140ms ease-in-out, transform 180ms ease-in-out"
        zIndex="0"
        css={{
          "--flat-container-shadow-offset": "0rem",
          WebkitMaskImage: shadowPatternMaskImage,
          WebkitMaskRepeat: "repeat",
          WebkitMaskSize: shadowPatternSize,
          maskImage: shadowPatternMaskImage,
          maskRepeat: "repeat",
          maskSize: shadowPatternSize,
        }}
        {...shadowPlacementStyles[variant]}
      />
      <Box
        ref={ref}
        bg="bg"
        borderColor="transparent"
        borderStyle={borderStyle}
        borderWidth={borderWidth}
        boxShadow="none"
        position="relative"
        zIndex="1"
        {...rest}
      >
        {children}
        <FlatContainerBorder
          borderColor={borderColor}
          extension={borderExtensionState.initial}
          borderStyle={borderStyle}
          borderWidth={borderWidth}
        />
      </Box>
    </Box>
  );
});
