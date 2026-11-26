/** Released engine document keys. Extensions can give their own local documents similar names. */
export function releasedJournalDocument(column: "key" | "document_id") {
  return `(starts_with(${column},'["ordered-') AND split_part(${column},'"',2) IN
    ('ordered-directory','ordered-return','ordered-conversion','ordered-conversion-frame','ordered-conversion-record',
     'ordered-conversion-view','ordered-retention','ordered-dependency','ordered-index-blob','ordered-replaced',
     'ordered-native-authored','ordered-native-field','ordered-native-room'))`;
}
