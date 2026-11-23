export interface LabMachine {
  id: string;
  name: string;
  template: string;
  state: string;
  createdAt: string;
  error: string;
}
export interface LabTemplate {
  name: string;
  version: string;
  description?: string;
  status: string;
}
export interface LabSnapshot {
  error?: string;
  instances: { id: string; name: string; state: string }[];
  selectedInstance: string | null;
  machines: LabMachine[];
  templates: LabTemplate[];
}
