import { Kbd } from "@chakra-ui/react";
import { Command } from "lucide-react";
import { Fragment } from "react";
import type { ShortcutBinding } from "./shortcut-registry";

export type ShortcutPlatform = "mac" | "windows";
export type ShortcutDisplayPart = { label: string; icon?: "command" };

const splitShortcutStep = (step: string) => {
  return step
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean);
};

export const getShortcutTokens = (binding: ShortcutBinding) => {
  if (Array.isArray(binding)) {
    return binding.map(splitShortcutStep);
  }

  return [splitShortcutStep(binding)];
};

const getShortcutDisplayLabel = (token: string, platform: ShortcutPlatform) => {
  if (token === "Mod") {
    return platform === "mac" ? "Cmd" : "Ctrl";
  }

  return token;
};

export const getShortcutPlatform = (platform = globalThis.navigator?.platform): ShortcutPlatform => {
  if (platform && /mac/i.test(platform)) {
    return "mac";
  }

  return "windows";
};

export const getShortcutDisplayTokens = (binding: ShortcutBinding, platform = getShortcutPlatform()) => {
  return getShortcutDisplayParts(binding, platform).map((step) => step.map((part) => part.label));
};

const getShortcutDisplayPart = (token: string, platform: ShortcutPlatform): ShortcutDisplayPart => {
  if (token === "Mod" && platform === "mac") {
    return { label: "Cmd", icon: "command" };
  }

  return { label: getShortcutDisplayLabel(token, platform) };
};

export const getShortcutDisplayParts = (binding: ShortcutBinding, platform = getShortcutPlatform()) => {
  return getShortcutTokens(binding).map((step) => step.map((token) => getShortcutDisplayPart(token, platform)));
};

export const ShortcutKbd = (props: { binding: ShortcutBinding }) => {
  const { binding } = props;
  const steps = getShortcutDisplayParts(binding);

  return (
    <>
      {steps.map((step, stepIndex) => (
        <Fragment key={`${step.map((part) => part.label).join("+")}-${stepIndex}`}>
          {step.map((part, partIndex) => (
            <Fragment key={`${part.label}-${partIndex}`}>
              <Kbd fontSize="xs" borderRadius="0" display="inline-flex" alignItems="center" aria-label={part.label}>
                {part.icon === "command" ? <Command size={12} aria-hidden="true" /> : part.label}
              </Kbd>
              {partIndex < step.length - 1 ? " + " : null}
            </Fragment>
          ))}
          {stepIndex < steps.length - 1 ? " then " : null}
        </Fragment>
      ))}
    </>
  );
};
