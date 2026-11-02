import { redirect } from 'next/navigation';

/** "Mi espacio" se repartió en Tareas, Hábitos, Calendario y Bases de datos. */
export default function Personal() {
  redirect('/personal/bases');
}
