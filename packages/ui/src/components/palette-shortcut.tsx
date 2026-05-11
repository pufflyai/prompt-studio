import { Kbd } from "@chakra-ui/react";
import { Fragment } from "react";

export type PaletteShortcutBinding = string | string[];

const splitShortcutStep = (step: string) => {
  return step
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean);
};

const getShortcutDisplayParts = (binding: PaletteShortcutBinding) => {
  const steps = Array.isArray(binding) ? binding.map(splitShortcutStep) : [splitShortcutStep(binding)];

  return steps.map((step) => step.map((label) => ({ label })));
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
              <Kbd fontSize="xs" borderRadius="0" display="inline-flex" alignItems="center" aria-label={part.label}>
                {part.label}
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
