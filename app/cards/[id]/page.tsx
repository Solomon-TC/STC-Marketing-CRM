import { redirect } from 'next/navigation';

// The Cards tab was removed from the app (cards and slots are still in the database).
export default function CardDetailPage() {
  redirect('/');
}
