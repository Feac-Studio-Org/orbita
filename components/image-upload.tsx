'use client';
import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { setAvatarUrl, setProjectLogo } from '@/lib/actions';

/** Reduce la imagen en el equipo (máx. 512 px, WebP) para que suba rápido sin importar el peso original. SVG se sube tal cual. */
async function shrink(file: File, max = 512): Promise<{ blob: Blob; ext: string; type: string }> {
  if (file.type === 'image/svg+xml') return { blob: file, ext: 'svg', type: file.type };
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/webp', 0.88));
  if (blob) return { blob, ext: 'webp', type: 'image/webp' };
  const png = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/png'));
  return { blob: png!, ext: 'png', type: 'image/png' };
}

export function ImageUpload({ kind, folder, project, label, children, className }: { kind: 'avatar' | 'logo'; folder: string; project?: string; label: string; children: React.ReactNode; className?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState('');

  async function pick(file?: File) {
    if (!file) return;
    setError('');
    if (!file.type.startsWith('image/')) return setError('Elige una imagen (JPG, PNG, WebP o SVG).');
    start(async () => {
      try {
        const { blob, ext, type } = await shrink(file);
        const supabase = createClient();
        const bucket = kind === 'avatar' ? 'avatars' : 'logos';
        const path = `${folder}/${kind}-${Date.now()}.${ext}`;
        const { error: up } = await supabase.storage.from(bucket).upload(path, blob, { contentType: type, cacheControl: '31536000' });
        if (up) throw new Error(up.message);
        const url = supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
        const r = kind === 'avatar' ? await setAvatarUrl(url) : await setProjectLogo(project!, url);
        if (r?.error) throw new Error(r.error);
        router.refresh();
      } catch (e) {
        setError('No se pudo subir: ' + (e as Error).message);
      }
    });
  }

  return (
    <>
      <button type="button" className={'img-up' + (pending ? ' busy' : '') + (className ? ' ' + className : '')} onClick={() => input.current?.click()} title={label} aria-label={label} disabled={pending}>
        {children}
        <span className="img-up-hint">{pending ? 'Subiendo…' : label}</span>
      </button>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
      {error && <p className="err" role="alert">{error}</p>}
    </>
  );
}
