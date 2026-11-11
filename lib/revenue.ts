import type { WebsiteClient } from './types';

// Single source of the revenue rules, so Finances and the Dashboard can't
// disagree. Revenue comes only from the Websites pipeline (website_clients):
//  - Static: each client's build fee, counted once.
//  - Recurring: each client's monthly fee, only while their maintenance is
//    set to Active.
// Both are dated by the client's Date closed, or the date they were added if
// that's blank. Spotlights deals and the Websites sales pipeline's
// Initial/Recurring values are no longer counted (their data is untouched).

export type RevenueClient = Pick<
  WebsiteClient,
  'build_fee' | 'monthly_fee' | 'maintenance_status' | 'date_closed' | 'created_at'
>;

export const REVENUE_CLIENT_COLUMNS = 'build_fee, monthly_fee, maintenance_status, date_closed, created_at';

export interface RevenuePoint {
  date: string;
  amount: number;
}

function revenueDate(c: RevenueClient) {
  return c.date_closed ?? c.created_at;
}

export function revenueFromClients(clients: RevenueClient[]) {
  const staticPoints: RevenuePoint[] = clients
    .filter((c) => c.build_fee != null)
    .map((c) => ({ date: revenueDate(c), amount: Number(c.build_fee) }));
  const recurringPoints: RevenuePoint[] = clients
    .filter((c) => c.monthly_fee != null && c.maintenance_status === 'active')
    .map((c) => ({ date: revenueDate(c), amount: Number(c.monthly_fee) }));
  return {
    staticPoints,
    recurringPoints,
    staticTotal: staticPoints.reduce((sum, p) => sum + p.amount, 0),
    recurringTotal: recurringPoints.reduce((sum, p) => sum + p.amount, 0),
  };
}
