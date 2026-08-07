import type { Metadata } from 'next'
import Script from 'next/script'
import { AuthProvider } from './auth/AuthProvider'
import { LanguageProvider } from '@/lib/i18n/LanguageProvider'
import { ThemeProvider } from '@/lib/theme/ThemeProvider'
import { defaultTheme, themeStorageKey } from '@/lib/theme/theme'
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
    <html lang="es" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <Script id="speleum-theme-init" strategy="beforeInteractive">
          {`(() => {
            try {
              const key = ${JSON.stringify(themeStorageKey)};
              const fallback = ${JSON.stringify(defaultTheme)};
              const stored = window.localStorage.getItem(key);
              const theme = stored === "light" || stored === "dark" ? stored : fallback;
              document.documentElement.dataset.theme = theme;
              document.documentElement.style.colorScheme = theme;
            } catch {
              document.documentElement.dataset.theme = ${JSON.stringify(defaultTheme)};
              document.documentElement.style.colorScheme = ${JSON.stringify(defaultTheme)};
            }
          })();`}
        </Script>
        <ThemeProvider>
          <LanguageProvider>
            <AuthProvider>{children}</AuthProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
