import { redirect } from 'next/navigation';

// The Tasks tab was folded into the combined To-Do tab; old links land there.
export default function TasksPage() {
  redirect('/todo');
}
