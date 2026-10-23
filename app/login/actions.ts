'use server';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

const enc = encodeURIComponent;

export async function entrar(form: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: String(form.get('correo')).trim(), password: String(form.get('clave')) });
  if (error) redirect('/login?error=' + enc(error.message.includes('confirm') ? 'Confirma tu correo antes de entrar: revisa tu bandeja.' : 'Correo o contraseña incorrectos.'));
  redirect('/');
}

export async function registrarse(form: FormData) {
  const supabase = await createClient();
  const h = await headers();
  const origin = h.get('origin') || `https://${h.get('host')}`;
  const { data, error } = await supabase.auth.signUp({
    email: String(form.get('correo')).trim(),
    password: String(form.get('clave')),
    options: { data: { full_name: String(form.get('nombre')).trim() }, emailRedirectTo: origin + '/auth/confirmar' },
  });
  if (error) redirect('/login?modo=registro&error=' + enc(error.message.includes('already') ? 'Ese correo ya tiene cuenta. Entra con tu contraseña.' : 'No se pudo crear la cuenta: ' + error.message));
  if (data.session) redirect('/');
  redirect('/login?ok=' + enc('Te enviamos un correo para confirmar la cuenta. Ábrelo y luego entra aquí.'));
}
