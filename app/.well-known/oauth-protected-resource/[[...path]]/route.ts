import type { NextRequest } from 'next/server';
import { CORS, json, resourceMetadata } from '@/lib/oauth';

export const GET = (r: NextRequest) => json(resourceMetadata(r.nextUrl.origin));
export const OPTIONS = () => new Response(null, { status: 204, headers: CORS });
