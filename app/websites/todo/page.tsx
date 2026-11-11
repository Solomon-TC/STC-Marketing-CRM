import { redirect } from 'next/navigation';

// The Websites-view To-Do page is now the combined To-Do tab.
export default function WebsiteTodoPage() {
  redirect('/todo');
}
