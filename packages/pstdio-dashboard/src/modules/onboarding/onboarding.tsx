import { Box, Button, Flex, HStack, Icon, Stack, Text } from "@chakra-ui/react";
import { AlertMessage, ScrollArea } from "@pstdio/ui";
import { ArrowLeft, ArrowRight, Check, ChevronRight, TriangleAlert } from "lucide-react";
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
    <Text as="h1" ref={title} tabIndex={-1} outline="none" textStyle="heading/M">
      {text}
    </Text>
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
    <ScrollArea flex="1" h="full" minH="0" viewportRef={viewport} contentProps={{ minH: "full" }}>
      <Stack
        w="full"
        maxW="chat-content"
        mx="auto"
        px={{ base: "md", md: "xl" }}
        py={{ base: "lg", md: "3xl" }}
        gap="xl"
      >
        <HStack justify="space-between" gap="sm">
          <HStack as="nav" aria-label={t("onboarding.steps")} gap="xs">
            <Button
              size="xs"
              variant="ghost"
              color={step === "harnesses" ? "fg" : "fg.muted"}
              onClick={() => setStep("harnesses")}
              aria-current={step === "harnesses" ? "step" : undefined}
            >
              {step === "work" && <Check />}
              {t("onboarding.harnesses")}
            </Button>
            <Icon boxSize="icon-2xs" color="fg.subtle">
              <ChevronRight />
            </Icon>
            <Button
              size="xs"
              variant="ghost"
              disabled={step === "harnesses"}
              aria-current={step === "work" ? "step" : undefined}
            >
              {t("onboarding.work")}
            </Button>
          </HStack>
          <Button size="xs" variant="ghost" disabled={saving} onClick={() => void save({ step: "skip" })}>
            {t("onboarding.skip")}
          </Button>
        </HStack>
        <Stack gap="xs">
          <StepHeading
            key={step}
            viewport={viewport}
            text={step === "harnesses" ? t("onboarding.chooseHarnesses") : t("onboarding.chooseWork")}
          />
          {step === "work" && (
            <Text textStyle="paragraph/S/regular" color="fg.muted">
              {t("onboarding.subtitle")}
            </Text>
          )}
        </Stack>
        <Box as="main">
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
        </Box>
        {error && (
          <AlertMessage status="error" title={t("onboarding.saveError")}>
            {error}
          </AlertMessage>
        )}
        <Flex as="footer" pt="lg" borderTopWidth="1px" borderColor="border.subtle" gap="md" align="center">
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
        </Flex>
      </Stack>
    </ScrollArea>
  );
};
