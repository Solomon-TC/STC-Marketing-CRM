export type DealStage =
  | 'cold_lead'
  | 'warm_lead'
  | 'called_contacted'
  | 'requested_followup'
  | 'followed_up'
  | 'won'
  | 'lost'
  | 'invoice_sent'
  | 'payment_received'
  | 'ad_made'
  | 'ad_confirmed';

export const DEAL_STAGES: { value: DealStage; label: string }[] = [
  { value: 'cold_lead', label: 'Cold lead' },
  { value: 'warm_lead', label: 'Warm lead' },
  { value: 'called_contacted', label: 'Called/contacted' },
  { value: 'requested_followup', label: 'Requested follow up' },
  { value: 'followed_up', label: 'Followed up' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
  { value: 'invoice_sent', label: 'Invoice sent' },
  { value: 'payment_received', label: 'Payment received' },
  { value: 'ad_made', label: 'Ad made' },
  { value: 'ad_confirmed', label: 'Ad confirmed' },
];

// The normal, guided path a deal follows. `lost` -> `called_contacted` is how
// a lost deal gets reopened back into the live pipeline. Stages not listed as
// a key have no further guided moves (e.g. ad_confirmed is a terminal state).
export const STAGE_TRANSITIONS: Record<DealStage, DealStage[]> = {
  cold_lead: ['called_contacted'],
  warm_lead: ['called_contacted'],
  called_contacted: ['requested_followup', 'won', 'lost'],
  requested_followup: ['followed_up'],
  followed_up: ['won', 'lost'],
  won: ['invoice_sent', 'lost'],
  invoice_sent: ['payment_received', 'lost'],
  payment_received: ['ad_made', 'lost'],
  ad_made: ['ad_confirmed', 'lost'],
  ad_confirmed: [],
  lost: ['called_contacted'],
};

export interface Contact {
  id: string;
  name: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  industry: string | null;
  location: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// Contacts imported without a name (e.g. a spreadsheet with only company names)
// fall back to their company as the display label.
export function contactDisplayName(contact: { name: string | null; company: string | null }): string {
  return contact.name || contact.company || 'Unnamed contact';
}

export interface Deal {
  id: string;
  contact_id: string | null;
  title: string;
  stage: DealStage;
  value: number | null;
  expected_close_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  contacts?: Pick<Contact, 'id' | 'name' | 'company'> | null;
}

export interface Task {
  id: string;
  contact_id: string | null;
  deal_id: string | null;
  title: string;
  due_date: string | null;
  done: boolean;
  created_at: string;
  contacts?: Pick<Contact, 'id' | 'name' | 'company'> | null;
}
