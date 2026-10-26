import { notFound } from 'next/navigation';
import { getContext } from '@/lib/data';
import { iceServers } from '@/lib/ice';
import { CallRoom } from '@/components/call-room';

export const metadata = { title: 'Llamada' };

export default async function CallPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user, profile } = await getContext();
  const { data: call } = await supabase.from('calls').select('id, channel_id, ended_at, started_at, channels (name, kind)').eq('id', id).maybeSingle();
  if (!call) notFound();
  const ch = call.channels as unknown as { name: string; kind: string } | null;
  let title = ch?.kind === 'direct' ? 'Llamada' : `Llamada en # ${ch?.name ?? ''}`;
  if (ch?.kind === 'direct') {
    const { data: ps } = await supabase.from('channel_participants').select('user_id').eq('channel_id', call.channel_id).neq('user_id', user.id);
    const { data: names } = ps?.length ? await supabase.from('profiles').select('full_name').in('id', ps.map((p) => p.user_id)) : { data: [] };
    title = 'Llamada con ' + ((names ?? []).map((n) => n.full_name).filter(Boolean).join(', ') || 'tu contacto');
  }
  const ice = await iceServers();
  const fresh = !call.ended_at && Date.now() - new Date(call.started_at).getTime() < 24 * 3600 * 1000;
  return <CallRoom callId={call.id} title={title} me={{ id: user.id, name: profile?.full_name || 'Yo', avatar: profile?.avatar_url ?? null }} ice={ice} backHref={`/mensajes?canal=${call.channel_id}`} active={fresh} />;
}
