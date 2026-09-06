import { preProcessFile } from "typescript";

export const sourceImports = (source: string) => preProcessFile(source).importedFiles.map((file) => file.fileName);
