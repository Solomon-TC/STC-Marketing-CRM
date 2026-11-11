import { redirect } from 'next/navigation';

// The Spotlights pipeline was removed from the app (its deals are still in the database).
export default function DealsPage() {
  redirect('/website-deals');
}
