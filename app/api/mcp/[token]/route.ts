import type { NextRequest } from 'next/server';
import { mcpGet, mcpOptions, mcpPost } from '@/lib/mcp-server';

export const dynamic = 'force-dynamic';
// Variante con el token en la dirección, para IAs que solo permiten pegar una URL.
export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  return mcpPost(request, (await params).token);
}
export const GET = mcpGet;
export const OPTIONS = mcpOptions;
