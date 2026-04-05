import { redirect } from 'next/navigation';

// Root "/" inside (dashboard) group redirects to /dashboard
export default function DashboardRoot() {
  redirect('/dashboard');
}
