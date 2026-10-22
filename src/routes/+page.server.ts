import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url, cookies }) => {
  if (!locals.user) {
    // "Open in Office™" from Drive while signed out: remember the file through login.
    const driveFileId = url.searchParams.get('drive');
    if (driveFileId && /^[A-Za-z0-9-]{1,64}$/.test(driveFileId)) {
      cookies.set('southbag_office_open_drive', driveFileId, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: url.protocol === 'https:',
        maxAge: 600
      });
    }
    redirect(302, '/login');
  }
  return {};
};
