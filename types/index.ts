export interface LeadData {
  name: string;
  email: string;
  source?: string;
  profileUrl?: string;
  subject: string;
  draftEmail: string;
  status: 'draft' | 'sent';
  regenerating?: boolean;
  sending?: boolean;
  generationFailed?: boolean;
}
