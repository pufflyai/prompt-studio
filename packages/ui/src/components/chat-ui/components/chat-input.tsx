import { Badge, Box, Button, Flex, HStack, Spacer, Stack, Text } from "@chakra-ui/react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { ScrollArea } from "@/components/scroll-area";
import { getTextFromSerializedEditorState, PromptEditor } from "../../rich-text";
import {
  type ChatInputAction,
  resolveChatInputButtonAction,
  resolveChatInputKeyboardAction,
} from "./chat-input-actions";
import { SendButton } from "./send-button";

export interface ChatInputQuestionOption {
  label: string;
  description?: string;
}

export interface ChatInputQuestion {
  id?: string;
  question: string;
  options: ChatInputQuestionOption[];
  multiple?: boolean;
  required?: boolean;
  allowCustomAnswer?: boolean;
}

export interface ChatInputQuestionPrompt {
  questions: ChatInputQuestion[];
}

interface ChatInputProps {
  defaultState: string;
  placeholder?: string;
  onSubmit?: (text: string, attachments: string[]) => void;
  onInterrupt?: () => void;
  streaming?: boolean;
  attachedResources?: string[];
  onClearAttachments?: () => void;
  isDisabled?: boolean;
  onChange?: (text: string) => void;
  attachmentList?: ReactNode;
  actions?: ReactNode;
  attachedToTop?: boolean;
  questionPrompt?: ChatInputQuestionPrompt;
}

const getQuestionSelectionKey = (question: ChatInputQuestion, index: number) => question.id ?? `question-${index}`;

export const getQuestionPromptSignature = (questionPrompt: ChatInputQuestionPrompt | undefined) => {
  if (!questionPrompt) return "";

  return JSON.stringify(
    questionPrompt.questions.map((question, index) => ({
      id: getQuestionSelectionKey(question, index),
      question: question.question,
      multiple: Boolean(question.multiple),
      required: Boolean(question.required),
      allowCustomAnswer: Boolean(question.allowCustomAnswer),
      options: question.options.map((option) => ({
        label: option.label,
        description: option.description ?? "",
      })),
    })),
  );
};

const getQuestionAnswerLines = (
  questionPrompt: ChatInputQuestionPrompt,
  selectedOptionsByQuestion: Record<string, string[]>,
) => {
  const lines: string[] = [];

  for (let index = 0; index < questionPrompt.questions.length; index += 1) {
    const question = questionPrompt.questions[index];
    const key = getQuestionSelectionKey(question, index);
    const selectedLabels = selectedOptionsByQuestion[key] ?? [];
    if (selectedLabels.length === 0) continue;

    lines.push(`${question.question}: ${selectedLabels.join(", ")}`);
  }

  return lines;
};

export const buildQuestionResponse = (
  questionPrompt: ChatInputQuestionPrompt | undefined,
  selectedOptionsByQuestion: Record<string, string[]>,
  freeformText: string,
) => {
  const trimmed = freeformText.trim();
  if (!questionPrompt) return trimmed;

  const lines = getQuestionAnswerLines(questionPrompt, selectedOptionsByQuestion);
  if (trimmed.length > 0) {
    const customQuestions = questionPrompt.questions.filter((question) => question.allowCustomAnswer);
    if (customQuestions.length === 0) {
      lines.push(`Additional response: ${trimmed}`);
    } else {
      for (const question of customQuestions) {
        lines.push(`${question.question} (custom): ${trimmed}`);
      }
    }
  }

  return lines.join("\n");
};

export const hasMissingRequiredQuestionAnswer = (
  questionPrompt: ChatInputQuestionPrompt | undefined,
  selectedOptionsByQuestion: Record<string, string[]>,
  freeformText: string,
) => {
  if (!questionPrompt) return false;

  const hasCustomText = freeformText.trim().length > 0;

  for (let index = 0; index < questionPrompt.questions.length; index += 1) {
    const question = questionPrompt.questions[index];
    if (!question.required) continue;

    const key = getQuestionSelectionKey(question, index);
    const hasSelectedOption = (selectedOptionsByQuestion[key] ?? []).length > 0;
    if (hasSelectedOption) continue;
    if (question.allowCustomAnswer && hasCustomText) continue;

    return true;
  }

  return false;
};

export const ChatInput = (props: ChatInputProps) => {
  const {
    defaultState,
    onSubmit = () => {},
    onInterrupt,
    streaming = false,
    attachedResources = [],
    onClearAttachments,
    isDisabled = false,
    onChange,
    placeholder,
    attachmentList,
    actions,
    attachedToTop = false,
    questionPrompt,
  } = props;

  const [isSelected, setIsSelected] = useState(false);
  const [editorState, setEditorState] = useState(defaultState);
  const [editorKey, setEditorKey] = useState(0);
  const [text, setText] = useState(() => getTextFromSerializedEditorState(defaultState));
  const [selectedOptionsByQuestion, setSelectedOptionsByQuestion] = useState<Record<string, string[]>>({});
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onChangeRef = useRef(onChange);
  const previousQuestionPromptSignatureRef = useRef(getQuestionPromptSignature(questionPrompt));

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const resetText = getTextFromSerializedEditorState(defaultState);
    setEditorState(defaultState);
    setEditorKey((key) => key + 1);
    setText(resetText);
    setSelectedOptionsByQuestion({});
    onChangeRef.current?.(resetText);
  }, [defaultState]);

  const questionPromptSignature = getQuestionPromptSignature(questionPrompt);

  useEffect(() => {
    if (previousQuestionPromptSignatureRef.current === questionPromptSignature) return;
    previousQuestionPromptSignatureRef.current = questionPromptSignature;
    setSelectedOptionsByQuestion({});
  }, [questionPromptSignature]);

  const focusEditor = () => {
    const editable = containerRef.current?.querySelector('[contenteditable="true"]');
    if (editable instanceof HTMLElement) {
      editable.focus();
    }
  };

  const handleContainerClick = () => {
    setIsSelected(true);
    focusEditor();
  };

  const resetEditor = (shouldFocus = false) => {
    setEditorState(defaultState);
    setEditorKey((key) => key + 1);
    const resetText = getTextFromSerializedEditorState(defaultState);
    setText(resetText);
    setSelectedOptionsByQuestion({});
    onChangeRef.current?.(resetText);

    if (shouldFocus) {
      requestAnimationFrame(() => {
        focusEditor();
      });
    }
  };

  const canInterrupt = streaming && Boolean(onInterrupt);
  const responseText = buildQuestionResponse(questionPrompt, selectedOptionsByQuestion, text);
  const hasMissingRequiredSelection = hasMissingRequiredQuestionAnswer(questionPrompt, selectedOptionsByQuestion, text);
  const actionState = { canInterrupt, isDisabled: isDisabled || hasMissingRequiredSelection, streaming, text: responseText };
  const buttonAction = resolveChatInputButtonAction(actionState);

  const submitMessage = () => {
    if (!responseText) return;

    onSubmit(responseText, attachedResources);

    resetEditor(true);

    onClearAttachments?.();
  };

  const runAction = (action: ChatInputAction) => {
    if (action === "interrupt") {
      onInterrupt?.();
      return;
    }

    if (action === "submit") {
      submitMessage();
    }
  };

  const handleKeyboardSubmit = () => {
    runAction(resolveChatInputKeyboardAction(actionState));
  };

  const handleButtonClick = () => {
    runAction(buttonAction);
  };

  const toggleQuestionOption = (question: ChatInputQuestion, questionIndex: number, optionLabel: string) => {
    const key = getQuestionSelectionKey(question, questionIndex);

    setSelectedOptionsByQuestion((current) => {
      const selected = current[key] ?? [];
      const alreadySelected = selected.includes(optionLabel);

      if (question.multiple) {
        return {
          ...current,
          [key]: alreadySelected ? selected.filter((label) => label !== optionLabel) : [...selected, optionLabel],
        };
      }

      return {
        ...current,
        [key]: alreadySelected ? [] : [optionLabel],
      };
    });
  };

  const placeholderNode = placeholder ? (
    <Text textStyle="label/M/regular" color="fg.subtle" pointerEvents="none" position="absolute" top="0">
      {placeholder}
    </Text>
  ) : undefined;

  return (
    <Box
      ref={containerRef}
      position="relative"
      width="100%"
      paddingX="lg"
      paddingY="md"
      mt={attachedToTop ? "-1px" : undefined}
      bg="bg"
      borderRadius="md"
      borderTopRadius={attachedToTop ? "0" : undefined}
      borderWidth="1px"
      borderStyle="solid"
      borderColor={isSelected ? "blue.border" : "border.muted"}
      boxShadow={isSelected ? "mid" : "low"}
      zIndex={isSelected ? 1 : 0}
      transition="box-shadow 0.2s ease-in-out, border-color 0.2s ease-in-out"
      _hover={{
        borderColor: isSelected ? "blue.border" : "border",
        boxShadow: "mid",
        zIndex: 1,
      }}
      _focusWithin={{
        borderColor: "blue.border",
        boxShadow: "mid",
        zIndex: 1,
      }}
      onClick={handleContainerClick}
      onBlur={() => setIsSelected(false)}
    >
      <Flex direction="column" color="fg">
        {attachmentList}
        {questionPrompt && (
          <Stack gap="sm" pb="sm">
            <Badge colorPalette="blue" variant="subtle" alignSelf="flex-start">
              Question
            </Badge>
            {questionPrompt.questions.map((question, questionIndex) => {
              const selectionKey = getQuestionSelectionKey(question, questionIndex);
              const selectedLabels = selectedOptionsByQuestion[selectionKey] ?? [];

              return (
                <Stack key={selectionKey} gap="2xs">
                  <Text textStyle="label/S/medium">{question.question}</Text>
                  <Flex gap="2xs" wrap="wrap">
                    {question.options.map((option) => {
                      const isSelected = selectedLabels.includes(option.label);
                      return (
                        <Button
                          key={option.label}
                          size="2xs"
                          variant={isSelected ? "solid" : "outline"}
                          onClick={() => toggleQuestionOption(question, questionIndex, option.label)}
                        >
                          {option.label}
                        </Button>
                      );
                    })}
                  </Flex>
                  {question.options.some((option) => option.description) && (
                    <Stack gap="0">
                      {question.options.map((option) => {
                        if (!option.description) return null;
                        return (
                          <Text key={`${option.label}-description`} textStyle="label/XS/regular" color="fg.muted">
                            {option.label}: {option.description}
                          </Text>
                        );
                      })}
                    </Stack>
                  )}
                  {question.allowCustomAnswer && (
                    <Text textStyle="label/XS/regular" color="fg.subtle">
                      You can also include a custom answer in the message box.
                    </Text>
                  )}
                </Stack>
              );
            })}
          </Stack>
        )}
        <ScrollArea maxH="10rem" showHorizontalScrollbar={false} contentProps={{ pr: "2xs" }}>
          <PromptEditor
            key={editorKey}
            defaultState={editorState}
            isEditable={!isDisabled}
            placeholder={placeholderNode}
            onChange={(t) => {
              setText(t);
              onChange?.(t);
            }}
            onSubmit={handleKeyboardSubmit}
          />
        </ScrollArea>
        <HStack gap="1" mt="md">
          {actions}
          <Spacer />
          <SendButton
            canInterrupt={canInterrupt}
            title={canInterrupt ? "Stop Response" : "Message Sending"}
            shortcut={streaming ? undefined : "Enter"}
            onClick={handleButtonClick}
            disabled={buttonAction === "none"}
          />
        </HStack>
      </Flex>
    </Box>
  );
};
