import { Kbd } from "@chakra-ui/react";
import { ArrowLeft, ArrowRight, Command, type LucideIcon, Option } from "lucide-react";
import { Fragment } from "react";

export type PaletteShortcutBinding = string | string[];
type ShortcutPlatform = "linux" | "mac" | "win";

interface ShortcutDisplayPart {
  label: string;
  Icon?: LucideIcon;
}

const nonMacModifierLabels: Record<string, ShortcutDisplayPart> = {
  alt: { label: "Alt" },
  control: { label: "Ctrl" },
  ctrl: { label: "Ctrl" },
  mod: { label: "Ctrl" },
  shift: { label: "Shift" },
};

const macModifierLabels: Record<string, ShortcutDisplayPart> = {
  alt: { label: "Option", Icon: Option },
  cmd: { label: "Command", Icon: Command },
  command: { label: "Command", Icon: Command },
  meta: { label: "Command", Icon: Command },
  mod: { label: "Command", Icon: Command },
  option: { label: "Option", Icon: Option },
  shift: { label: "Shift" },
};

const keyLabels: Record<string, ShortcutDisplayPart> = {
  arrowleft: { label: "Arrow Left", Icon: ArrowLeft },
  arrowright: { label: "Arrow Right", Icon: ArrowRight },
};

const getShortcutPlatform = (): ShortcutPlatform => {
  if (typeof navigator === "undefined") return "linux";

  const platform = navigator.platform?.toLowerCase() ?? "";
  if (platform.includes("mac")) return "mac";
  if (platform.includes("win")) return "win";
  return "linux";
};

export const resolveShortcutDisplayPart = (label: string, platform = getShortcutPlatform()): ShortcutDisplayPart => {
  const normalized = label.toLowerCase();
  const modifierLabels = platform === "mac" ? macModifierLabels : nonMacModifierLabels;
  return keyLabels[normalized] ?? modifierLabels[normalized] ?? { label };
};

const splitShortcutStep = (step: string) => {
  return step
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean);
};

const getShortcutDisplayParts = (binding: PaletteShortcutBinding) => {
  const steps = Array.isArray(binding) ? binding.map(splitShortcutStep) : [splitShortcutStep(binding)];

  return steps.map((step) => step.map((label) => resolveShortcutDisplayPart(label)));
};

export const PaletteShortcut = (props: { binding: PaletteShortcutBinding }) => {
  const { binding } = props;
  const steps = getShortcutDisplayParts(binding);

  return (
    <>
      {steps.map((step, stepIndex) => (
        <Fragment key={`${step.map((part) => part.label).join("+")}-${stepIndex}`}>
          {step.map((part, partIndex) => (
            <Fragment key={`${part.label}-${partIndex}`}>
              <Kbd
                fontSize="xs"
                borderRadius="0"
                display="inline-flex"
                alignItems="center"
                justifyContent="center"
                aria-label={part.label}
              >
                {part.Icon ? <part.Icon size={12} aria-hidden="true" /> : part.label}
              </Kbd>
              {partIndex < step.length - 1 ? " " : null}
            </Fragment>
          ))}
          {stepIndex < steps.length - 1 ? " then " : null}
        </Fragment>
      ))}
    </>
  );
};
