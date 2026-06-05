import type { Metadata } from 'next';
import { Sora, Source_Serif_4, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const sora = Sora({ subsets: ['latin'], variable: '--font-sora', display: 'swap' });
const sourceSerif = Source_Serif_4({ subsets: ['latin'], variable: '--font-source-serif', display: 'swap' });
const jetbrains = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains', display: 'swap' });

export const metadata: Metadata = {
  title: 'DataShield — Diagnóstico Ley 21.719',
  description: 'Plataforma de diagnóstico de cumplimiento de la Ley 21.719 de Protección de Datos Personales',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${sora.variable} ${sourceSerif.variable} ${jetbrains.variable}`}>
      <body style={{ fontFamily: 'var(--font-sora), Sora, sans-serif' }}>
        {children}
      </body>
    </html>
  );
}
