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

// Stages counted as "won or better" for card-slot assignment eligibility.
export const WON_OR_BETTER_STAGES: DealStage[] = [
  'won',
  'invoice_sent',
  'payment_received',
  'ad_made',
  'ad_confirmed',
];

// Loose city match used to line up a contact's free-text location with a
// card's city (e.g. contact location "Portland, OR" vs card city "Portland").
export function citiesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = (a ?? '').trim().toLowerCase();
  const y = (b ?? '').trim().toLowerCase();
  if (!x || !y) return false;
  return x.includes(y) || y.includes(x);
}

export interface Contact {
  id: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  industry: string | null;
  location: string | null;
  created_at: string;
  updated_at: string;
}

// Company is the sole identifier for a contact (no personal name field).
export function contactDisplayName(contact: { company: string | null }): string {
  return contact.company || 'Unnamed contact';
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
  contacts?: Pick<Contact, 'id' | 'company' | 'location' | 'industry'> | null;
}

export interface Task {
  id: string;
  contact_id: string | null;
  deal_id: string | null;
  title: string;
  due_date: string | null;
  done: boolean;
  created_at: string;
  contacts?: Pick<Contact, 'id' | 'company'> | null;
}

// --- Contact notes log ---
// Every note is a separate timestamped entry rather than one big free-text
// field, so there's a real history instead of an ever-growing blob.

export interface ContactNote {
  id: string;
  contact_id: string;
  body: string;
  created_at: string;
}

export function formatNoteTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// --- Card management ---
// A "card" is one physical 9x12 postcard mailer for a specific city/month,
// made up of ad slots that local businesses buy.

export type CardStatus = 'filling' | 'ready' | 'sent' | 'archived';
export type SlotType = 'half' | 'regular' | 'double' | 'half_page';
export type SlotStatus = 'open' | 'filled';

export const BREAK_EVEN_COST = 2899;

export const SLOT_TYPES: { value: SlotType; label: string; dimensions: string; price: number }[] = [
  { value: 'half', label: 'Half', dimensions: '2.8" x 1.8"', price: 200 },
  { value: 'regular', label: 'Regular', dimensions: '2.8" x 3.8"', price: 350 },
  { value: 'double', label: 'Double', dimensions: '5.8" x 3.8"', price: 600 },
  { value: 'half_page', label: 'Half Page', dimensions: '11.7" x 3.8"', price: 1000 },
];

export const CARD_STATUSES: { value: CardStatus; label: string }[] = [
  { value: 'filling', label: 'Filling' },
  { value: 'ready', label: 'Ready to Send' },
  { value: 'sent', label: 'Sent' },
  { value: 'archived', label: 'Archived' },
];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// Parsed from the 'YYYY-MM-DD' string directly (rather than via `new Date`)
// so the displayed month never shifts a day from timezone conversion.
export function formatCardMonth(month: string): string {
  const [year, mon] = month.split('-');
  return `${MONTH_NAMES[Number(mon) - 1]} ${year}`;
}

export interface CardSlot {
  id: string;
  card_id: string;
  slot_type: SlotType;
  price: number;
  business_name: string | null;
  contact_id: string | null;
  status: SlotStatus;
  created_at: string;
}

export interface Card {
  id: string;
  city: string;
  month: string;
  status: CardStatus;
  notes: string | null;
  created_at: string;
  card_slots?: CardSlot[];
}
