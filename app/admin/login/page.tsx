import { redirect } from 'next/navigation';

/** Login is no longer required — redirect straight to the dashboard. */
export default function LoginRedirect() {
  redirect('/admin/dashboard');
}
