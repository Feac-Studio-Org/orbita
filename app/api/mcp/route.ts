import type { NextRequest } from 'next/server';
import { mcpGet, mcpPost } from '@/lib/mcp-server';

export const dynamic = 'force-dynamic';
export const POST = (request: NextRequest) => mcpPost(request, null);
export const GET = mcpGet;
