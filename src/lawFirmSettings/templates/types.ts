// Action Templates — types (SCAFFOLD).

// Only the three document-producing actions are templated this pass.
export type TemplateActionType = 'send_lor' | 'request_records' | 'request_bills';

export interface MergeField {
  key: string;    // dotted, e.g. 'client.fullName'
  label: string;  // human label for the editor
  required: boolean;
}

export interface DocTemplate {
  id: string;
  actionType: TemplateActionType;
  name: string;            // firm-facing name
  subject?: string;        // letter/email subject line
  body: string;            // text with {{merge.key}} tokens
  isFirmDefault: boolean;  // seeded default vs firm-customized
  fields: MergeField[];    // fields this template expects
}
