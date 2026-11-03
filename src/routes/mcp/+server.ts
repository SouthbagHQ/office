// Agent access (MCP): bearer agent token, $1 request fee per tools/call, discovery free.
// See src/lib/server/mcp.ts.
import type { RequestHandler } from './$types';
import { handleMcp } from '$lib/server/mcp';

const handler: RequestHandler = async ({ request, platform }) => handleMcp(request, platform!.env as never);

export const POST = handler;
export const GET = handler;
export const DELETE = handler;
export const PUT = handler;
export const PATCH = handler;
