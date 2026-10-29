import { Box, Button, Dialog, HStack, Icon, Stack, Text } from "@chakra-ui/react";
import { AlertMessage, ScrollArea } from "@pstdio/ui";
import { ArrowLeft, ArrowRight, TriangleAlert } from "lucide-react";
import type { OnboardingInfo, OnboardingState, OnboardingWorkArea, UpdateOnboarding } from "pstdio-api-contracts";
import { type RefObject, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { HarnessChoices, WorkChoices } from "./choices";

interface OnboardingProps {
  info: OnboardingInfo;
  update: (request: UpdateOnboarding) => Promise<OnboardingState>;
  onComplete: () => void;
}
const StepHeading = (props: { text: string; viewport: RefObject<HTMLDivElement | null> }) => {
  const { text, viewport } = props;
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    title.current?.focus();
    viewport.current?.scrollTo({ top: 0 });
  }, [viewport]);
  return (
    <Dialog.Title as="h1" ref={title} tabIndex={-1} outline="none">
      {text}
    </Dialog.Title>
  );
};
export const Onboarding = (props: OnboardingProps) => {
  const { info, update, onComplete } = props;
  const { t } = useTranslation("common");
  const [step, setStep] = useState<"harnesses" | "work">("harnesses");
  const [harnesses, setHarnesses] = useState(info.state.harnesses ?? info.detectedHarnesses);
  const [workAreas, setWorkAreas] = useState<OnboardingWorkArea[]>(info.state.workAreas ?? ["coding"]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const viewport = useRef<HTMLDivElement>(null);
  const save = async (request: UpdateOnboarding) => {
    setSaving(true);
    setError(undefined);
    try {
      await update(request);
      if (request.step === "harnesses") setStep("work");
      else onComplete();
    } catch (error) {
      setError(error instanceof Error ? error.message : t("onboarding.saveError"));
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
      <Dialog.Header px="md" py="sm">
        <HStack w="full" justify="space-between" gap="sm">
          <StepHeading
            key={step}
            viewport={viewport}
            text={step === "harnesses" ? t("onboarding.chooseHarnesses") : t("onboarding.chooseWork")}
          />
          <Button size="sm" variant="ghost" disabled={saving} onClick={() => void save({ step: "skip" })}>
            {t("onboarding.skip")}
          </Button>
        </HStack>
      </Dialog.Header>
      <Dialog.Body p="0" minH="0">
        <ScrollArea h="full" viewportRef={viewport}>
          <Stack p="md" gap="lg">
            {step === "work" && (
              <Text textStyle="paragraph/S/regular" color="fg.muted">
                {t("onboarding.subtitle")}
              </Text>
            )}
            {step === "harnesses" ? (
              <HarnessChoices
                selected={harnesses}
                detected={info.detectedHarnesses}
                platform={info.platform}
                onChange={setHarnesses}
              />
            ) : (
              <WorkChoices selected={workAreas} onChange={setWorkAreas} />
            )}
            {error && (
              <AlertMessage status="error" title={t("onboarding.saveError")}>
                {error}
              </AlertMessage>
            )}
          </Stack>
        </ScrollArea>
      </Dialog.Body>
      <Dialog.Footer as="footer" p="md" gap="md">
        {step === "work" && (
          <Button size="sm" variant="ghost" onClick={() => setStep("harnesses")}>
            <ArrowLeft />
            {t("onboarding.back")}
          </Button>
        )}
        {step === "harnesses" && !harnesses.length ? (
          <HStack role="alert" gap="xs" color="fg.warning" flex="1" minW="0" alignItems="flex-start">
            <Icon boxSize="icon-xs" flexShrink="0" mt="3xs">
              <TriangleAlert />
            </Icon>
            <Text textStyle="paragraph/S/regular">{t("onboarding.noHarness")}</Text>
          </HStack>
        ) : (
          <Box flex="1" />
        )}
        <Button
          size="sm"
          variant="primary"
          loading={saving}
          onClick={() =>
            void save(step === "harnesses" ? { step: "harnesses", harnesses } : { step: "complete", workAreas })
          }
        >
          {step === "harnesses" ? t("onboarding.continue") : t("onboarding.finish")}
          <ArrowRight />
        </Button>
      </Dialog.Footer>
    </>
  );
};
