import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from 'react-hot-toast';
import ServiceWorkerRegistrar from '@/components/ServiceWorkerRegistrar';

// Motinha de entrega como SVG inline (data URI): sem arquivo hospedado, sem request
// extra. Nas telas da loja o favicon é trocado pela logo do restaurante em runtime
// (ver hooks/useFaviconLoja).
const FAVICON_PECA_JA =
  "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20100%20100'%3E%3Ctext%20y='.9em'%20font-size='90'%3E%F0%9F%9B%B5%3C/text%3E%3C/svg%3E";

export const metadata: Metadata = {
  title: 'Peça Já — O delivery da sua loja, sem comissão',
  description: 'Cardápio digital, pedidos em tempo real, rastreamento do entregador e fidelização. Tudo no seu link, com a sua marca.',
  manifest: '/manifest.json',
  icons: { icon: FAVICON_PECA_JA },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="theme-color" content="#0d0b09" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Peça Já" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body>
        <ServiceWorkerRegistrar />
        {children}
        <Toaster position="top-center" toastOptions={{ duration: 3000 }} />
      </body>
    </html>
  );
}
