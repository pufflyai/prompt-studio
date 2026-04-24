import { Kbd } from "@chakra-ui/react";
import { Fragment } from "react";
import type { ShortcutBinding } from "./shortcut-registry";

export type ShortcutPlatform = "mac" | "windows";

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
  return getShortcutTokens(binding).map((step) => step.map((token) => getShortcutDisplayLabel(token, platform)));
};

export const ShortcutKbd = (props: { binding: ShortcutBinding }) => {
  const { binding } = props;
  const steps = getShortcutDisplayTokens(binding);

  return (
    <>
      {steps.map((step, stepIndex) => (
        <Fragment key={`${step.join("+")}-${stepIndex}`}>
          {step.map((part, partIndex) => (
            <Fragment key={`${part}-${partIndex}`}>
              <Kbd fontSize="xs" borderRadius="0">
                {part}
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
