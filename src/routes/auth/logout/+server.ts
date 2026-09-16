import { clearSession } from '$lib/server/session';
import { capture, palantirOptions } from '$lib/server/palantir';
import { redirect, type RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = ({ cookies, locals, request, platform }) => {
  void capture('office_logout', locals.user?.sub, {}, palantirOptions(request, platform));
  clearSession(cookies);
  redirect(302, '/login');
};
