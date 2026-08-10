import { clearSession } from '$lib/server/session';
import { redirect, type RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = ({ cookies }) => {
  clearSession(cookies);
  redirect(302, '/login');
};
