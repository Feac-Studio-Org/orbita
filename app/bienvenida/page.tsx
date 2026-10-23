import type { Metadata } from 'next';
import { Landing } from './landing';
import './landing.css';

export const metadata: Metadata = {
  title: 'Órbita · Todo tu trabajo, en órbita',
  description: 'Proyectos, documentos, calendario, finanzas, mensajes y tu IA conectada por MCP, en un solo lugar. Un producto de FEAC Estudio.',
  robots: { index: true, follow: true },
  openGraph: { title: 'Órbita', description: 'Todo tu trabajo, en órbita. Un producto de FEAC Estudio.', images: ['/icon-512.png'] },
};

export default function Page() {
  return <Landing />;
}
