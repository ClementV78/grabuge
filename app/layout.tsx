import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Grabuge — Pirates en pagaille',
  description:
    'Artillerie cartoon en temps réel. Des pirates, des explosions, zéro tour par tour.',
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
