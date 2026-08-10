import { dev } from '$app/environment';
import { developmentJwks } from '$lib/server/dev-idp';
import { json, type RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async () =>
  dev ? json(await developmentJwks()) : new Response('Not found', { status: 404 });
