import type { Metadata, Viewport } from 'next';
import { Inter_Tight, Instrument_Serif, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const sans = Inter_Tight({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const serif = Instrument_Serif({ subsets: ['latin'], weight: '400', style: 'italic', variable: '--font-serif', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'Órbita', template: '%s · Órbita' },
  description: 'Proyectos, documentos, calendario y finanzas en un solo lugar. FEAC Estudio.',
  manifest: '/manifest.webmanifest',
  // En iPhone, Órbita se instala desde Safari con "Agregar a pantalla de inicio".
  appleWebApp: { capable: true, title: 'Órbita', statusBarStyle: 'black' },
  icons: { apple: '/apple-icon.png' },
  robots: { index: false, follow: false },
};
// Ancho del celular, sin acercar al tocar un campo; pellizcar para ampliar sigue funcionando en iPhone.
export const viewport: Viewport = { themeColor: '#0a090c', width: 'device-width', initialScale: 1, maximumScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${sans.variable} ${serif.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
