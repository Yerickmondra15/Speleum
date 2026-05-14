import type { Metadata } from 'next'
import { AuthProvider } from './auth/AuthProvider'
import './globals.css'

export const metadata: Metadata = {
  title: 'Speleum | Supervivencia en cuevas',
  description: 'Juego web de supervivencia en cuevas con vision limitada, radar de senales, combate, ranking y persistencia.',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es">
      <body className="font-sans antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
