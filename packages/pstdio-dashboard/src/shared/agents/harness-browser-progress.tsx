import { Button, Code, HStack, Input, Spinner, Stack } from "@chakra-ui/react";
import { CopyButton, EmptyState } from "@pstdio/ui";
import { SelectionInput } from "@pstdio/ui/param-editor";
import type { HarnessAuthenticationPrompt, HarnessAuthenticationQuestion } from "pstdio-api-contracts";
import { useState } from "react";
import { useTranslation } from "react-i18next";

type BrowserPrompt = Extract<HarnessAuthenticationPrompt, { type: "browser" }>;
interface HarnessBrowserProgressProps {
  name: string;
  action: "login" | "logout";
  prompt?: BrowserPrompt;
  question?: HarnessAuthenticationQuestion;
  message?: string;
  onReply?(value: string): void;
  onCancel(): void;
}
const AccountQuestion = (props: { question: HarnessAuthenticationQuestion; onReply(value: string): void }) => {
  const { question, onReply } = props;
  const { t } = useTranslation("projects");
  const [value, setValue] = useState(
    question.type === "select" ? (question.initial ?? question.options[0]?.id ?? "") : "",
  );
  return (
    <Stack asChild gap="sm" w="full">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onReply(value);
          setValue("");
        }}
      >
        {question.type === "select" ? (
          <SelectionInput
            id="account-choice"
            name={question.title}
            description=""
            defaultValue={value}
            options={question.options.map((option) => ({
              id: option.id,
              name: option.label,
              description: option.description,
            }))}
            onChange={(_, next) => setValue(String(next))}
            hideLabel
            searchable
            fullWidth
          />
        ) : (
          <Input
            aria-label={question.title}
            placeholder={question.placeholder}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            type={question.secret ? "password" : "text"}
            autoComplete="off"
            autoFocus
            size="sm"
          />
        )}
        <Button type="submit" size="sm" variant="outline" disabled={!value}>
          {t("harnessAccount.continue")}
        </Button>
      </form>
    </Stack>
  );
};
export const HarnessBrowserProgress = (props: HarnessBrowserProgressProps) => {
  const { name, action, prompt, question, message, onReply, onCancel } = props;
  const { t } = useTranslation("projects");
  return (
    <EmptyState
      title={
        question?.title ?? t(action === "login" ? "harnessAccount.loginTitle" : "harnessAccount.logoutTitle", { name })
      }
      description={
        question
          ? undefined
          : (message ??
            prompt?.message ??
            t(prompt?.code ? "harnessAccount.deviceInstructions" : "harnessAccount.waiting"))
      }
      icon={question ? undefined : <Spinner size="lg" />}
    >
      <Stack gap="sm" align="center" w="full" maxW="sm">
        {prompt?.code ? (
          <HStack gap="xs">
            <Code>{prompt.code}</Code>
            <CopyButton text={prompt.code} />
          </HStack>
        ) : null}
        {prompt ? (
          <Button asChild size="sm" variant="outline">
            <a href={prompt.url} target="_blank" rel="noopener noreferrer">
              {t("harnessAccount.openPage")}
            </a>
          </Button>
        ) : null}
        {question && onReply ? (
          <AccountQuestion key={JSON.stringify(question)} question={question} onReply={onReply} />
        ) : null}
        <Button size="sm" variant="ghost" onClick={onCancel}>
          {t("harnessAccount.cancel")}
        </Button>
      </Stack>
    </EmptyState>
  );
};
