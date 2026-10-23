import type { NextRequest } from 'next/server';
import { CORS, authServerMetadata, json } from '@/lib/oauth';

export const GET = (r: NextRequest) => json(authServerMetadata(r.nextUrl.origin));
export const OPTIONS = () => new Response(null, { status: 204, headers: CORS });
