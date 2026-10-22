import { env } from '$env/dynamic/private';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => ({
  user: locals.user,
  driveOrigin: env.DRIVE_ORIGIN || 'https://drive.southbag.cc'
});
