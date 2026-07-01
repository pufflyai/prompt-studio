import { Box, Table, Text, Textarea } from "@chakra-ui/react";
import { ScrollArea } from "@/components/primitives/scroll-area";
import type { CodeEditorProps, DataTableProps } from "../types/rich-text-components";

const scaledSmallFontSize = "calc(var(--chakra-font-sizes-sm) * var(--rich-text-font-scale))";

const formatValue = (value: unknown) => {
  if (value === null || value === undefined) return "-";
  if (typeof value === "string") return value.length ? value : "-";
  if (typeof value === "number" || typeof value === "boolean") return String(value).toUpperCase();
  if (value instanceof Date) return value.toISOString();
  return JSON.stringify(value);
};

export const DefaultRichTextCodeEditor = (props: CodeEditorProps) => {
  const { defaultCode = "", isEditable = false, showLineNumbers = false, disableScroll = false } = props;

  if (isEditable) {
    return (
      <Textarea
        defaultValue={defaultCode}
        fontFamily="mono"
        fontSize={scaledSmallFontSize}
        resize="vertical"
        minHeight="100%"
      />
    );
  }

  const lines = showLineNumbers ? defaultCode.split("\n") : [defaultCode];

  const codeBlock = (
    <Box
      as="pre"
      margin={0}
      padding="sm"
      fontFamily="mono"
      fontSize={scaledSmallFontSize}
      lineHeight="1.5"
      background="bg.code"
      borderRadius="md"
      width="100%"
      overflowY={disableScroll ? "hidden" : undefined}
    >
      {showLineNumbers ? (
        <Box as="code" display="grid" gridTemplateColumns="auto 1fr" columnGap="sm">
          {lines.map((line, index) => (
            <Box as="span" key={`${index}-${line}`} display="contents">
              <Text as="span" color="fg.muted" textAlign="right" fontSize="inherit">
                {index + 1}
              </Text>
              <Text as="span" fontSize="inherit">
                {line.length ? line : " "}
              </Text>
            </Box>
          ))}
        </Box>
      ) : (
        <Box as="code">{defaultCode}</Box>
      )}
    </Box>
  );

  if (disableScroll) return codeBlock;

  return (
    <ScrollArea width="100%" background="bg.code" borderRadius="md" showHorizontalScrollbar>
      {codeBlock}
    </ScrollArea>
  );
};

export const DefaultRichTextDataTable = (props: DataTableProps) => {
  const { data, fullWidth = false, noBorder = false, hiddenColumns = [] } = props;

  if (!data.length) {
    return (
      <Box padding="sm" borderWidth={noBorder ? "0" : "1px"} borderColor="border.subtle">
        <Text textStyle="label/S/regular" fontSize={scaledSmallFontSize} color="fg.muted">
          No data
        </Text>
      </Box>
    );
  }

  const hiddenSet = new Set(hiddenColumns);
  const columns = Object.keys(data[0] ?? {}).filter((key) => !hiddenSet.has(key));

  return (
    <ScrollArea maxWidth="100%" showHorizontalScrollbar showVerticalScrollbar={false}>
      <Table.Root
        size="sm"
        width={fullWidth ? "100%" : "fit-content"}
        borderWidth={noBorder ? "0" : "1px"}
        borderColor="border.subtle"
      >
        <Table.Header>
          <Table.Row background="bg.muted">
            {columns.map((column) => (
              <Table.ColumnHeader key={column} textTransform="none" paddingX="xs" paddingY="2xs">
                <Text textStyle="label/S/medium" fontSize={scaledSmallFontSize}>
                  {column}
                </Text>
              </Table.ColumnHeader>
            ))}
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {data.map((row, rowIndex) => (
            <Table.Row key={`${rowIndex}-${columns.join("-")}`}>
              {columns.map((column) => (
                <Table.Cell key={`${rowIndex}-${column}`} paddingX="xs" paddingY="2xs">
                  <Text textStyle="paragraph/S/regular" fontSize={scaledSmallFontSize}>
                    {formatValue(row[column])}
                  </Text>
                </Table.Cell>
              ))}
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>
    </ScrollArea>
  );
};
