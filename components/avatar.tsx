import { initial } from '@/lib/format';

export function Avatar({ name, url, size = 32 }: { name?: string | null; url?: string | null; size?: number }) {
  if (url) return <img src={url} alt="" width={size} height={size} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flex: 'none', border: '1px solid var(--line-2)' }} />;
  return <span className="avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}>{initial(name)}</span>;
}
