import { Box, Code, chakra, Heading, Stack, Text } from "@chakra-ui/react";
import { composeStory } from "@storybook/react";
import {
  type ComponentType,
  createContext,
  createElement,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";

type Annotations = Parameters<typeof composeStory>[1];
const DocumentAnnotations = createContext<Annotations>({});
const emptyAnnotations: Annotations = {};
export const Meta = () => null;
export const Canvas = (props: { of: Parameters<typeof composeStory>[0] }) => {
  const { of } = props;
  const annotations = useContext(DocumentAnnotations);
  const [Story, setStory] = useState<ComponentType>();
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const story = composeStory(of, annotations);
    story
      .load()
      .then(() => {
        if (active) setStory(() => story as ComponentType);
      })
      .catch((error) => {
        if (active) setError(String(error));
      });
    return () => {
      active = false;
    };
  }, [of, annotations]);
  return (
    <Box w="full" borderWidth="1px" borderColor="border.subtle" borderRadius="xs" display="flow-root">
      {error && (
        <Text role="alert" color="fg.error">
          {error}
        </Text>
      )}
      {Story && createElement(Story)}
    </Box>
  );
};
export const Source = (props: { code?: string }) => (
  <Box as="pre" p="md" bg="bg.subtle" textStyle="mono/S" whiteSpace="pre-wrap" overflowWrap="anywhere">
    {props.code}
  </Box>
);
const components = {
  h1: (props: { children?: ReactNode }) => (
    <Heading as="h1" textStyle="heading/L">
      {props.children}
    </Heading>
  ),
  h2: (props: { children?: ReactNode }) => (
    <Heading as="h2" textStyle="heading/M">
      {props.children}
    </Heading>
  ),
  h3: (props: { children?: ReactNode }) => (
    <Heading as="h3" textStyle="heading/S">
      {props.children}
    </Heading>
  ),
  p: (props: { children?: ReactNode }) => <Text textStyle="paragraph/M/regular">{props.children}</Text>,
  ul: (props: { children?: ReactNode }) => <chakra.ul ps="lg">{props.children}</chakra.ul>,
  ol: (props: { children?: ReactNode }) => <chakra.ol ps="lg">{props.children}</chakra.ol>,
  code: (props: { children?: ReactNode }) => (
    <Code whiteSpace="pre-wrap" overflowWrap="anywhere">
      {props.children}
    </Code>
  ),
};
interface DocumentProps {
  component: ComponentType<{ components: typeof components }>;
  annotations?: Annotations;
}
export const Document = (props: DocumentProps) => {
  const { component: Content, annotations = emptyAnnotations } = props;
  return (
    <DocumentAnnotations value={annotations}>
      <Stack p="lg" gap="md">
        <Content components={components} />
      </Stack>
    </DocumentAnnotations>
  );
};
