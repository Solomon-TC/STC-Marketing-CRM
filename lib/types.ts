export type DealStage =
  | 'warm_lead'
  | 'called_contacted'
  | 'requested_followup'
  | 'followed_up'
  | 'won'
  | 'fulfilled_obligation'
  | 'lost';

export const DEAL_STAGES: { value: DealStage; label: string }[] = [
  { value: 'warm_lead', label: 'Warm lead' },
  { value: 'called_contacted', label: 'Called/contacted' },
  { value: 'requested_followup', label: 'Requested follow up' },
  { value: 'followed_up', label: 'Followed up' },
  { value: 'won', label: 'Won' },
  { value: 'fulfilled_obligation', label: 'Fulfilled Obligation' },
  { value: 'lost', label: 'Lost' },
];

// The normal, guided path a deal follows. `lost` -> `called_contacted` is how
// a lost deal gets reopened back into the live pipeline. Stages not listed as
// a key have no further guided moves (e.g. fulfilled_obligation is terminal).
export const STAGE_TRANSITIONS: Record<DealStage, DealStage[]> = {
  warm_lead: ['called_contacted'],
  called_contacted: ['requested_followup', 'won', 'lost'],
  requested_followup: ['followed_up'],
  followed_up: ['won', 'lost'],
  won: ['fulfilled_obligation', 'lost'],
  fulfilled_obligation: [],
  lost: ['called_contacted'],
};

// Stages counted as "won or better" for card-slot assignment eligibility.
export const WON_OR_BETTER_STAGES: DealStage[] = ['won', 'fulfilled_obligation'];

// Shared kanban column styling for any pipeline built on DealStage (both the
// Spotlights and Websites pipelines use this). Roughly matches the
// whiteboard process map: orange/pink for the lead stages, purple for the
// follow-up stages, green for won and a deeper green for fully fulfilled,
// red for lost.
export const STAGE_COLORS: Record<DealStage, { header: string; text: string; count: string }> = {
  warm_lead: { header: 'bg-orange-50 border-orange-200', text: 'text-orange-700', count: 'text-orange-400' },
  called_contacted: { header: 'bg-pink-50 border-pink-200', text: 'text-pink-700', count: 'text-pink-400' },
  requested_followup: { header: 'bg-purple-50 border-purple-200', text: 'text-purple-700', count: 'text-purple-400' },
  followed_up: { header: 'bg-violet-50 border-violet-200', text: 'text-violet-700', count: 'text-violet-400' },
  won: { header: 'bg-green-50 border-green-200', text: 'text-green-700', count: 'text-green-400' },
  fulfilled_obligation: { header: 'bg-green-100 border-green-300', text: 'text-green-800', count: 'text-green-500' },
  lost: { header: 'bg-red-50 border-red-200', text: 'text-red-700', count: 'text-red-400' },
};

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
  // Set by the app the moment a deal is moved to "won" -- the timeline basis
  // for the Finances charts, since a stage change is the only reliable
  // revenue-recognition event this data model has.
  won_at: string | null;
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

// The Websites Pipeline: same stages/structure as the Spotlights pipeline
// (Deal) and pulls from the same contacts, but lives in its own table with
// its own data, has no link to the Cards system, and tracks two dollar
// amounts instead of one -- a one-time initial value and a monthly
// recurring value.
export interface WebsiteDeal {
  id: string;
  contact_id: string | null;
  title: string;
  stage: DealStage;
  initial_value: number | null;
  recurring_value: number | null;
  expected_close_date: string | null;
  won_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  contacts?: Pick<Contact, 'id' | 'company' | 'location' | 'industry'> | null;
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
