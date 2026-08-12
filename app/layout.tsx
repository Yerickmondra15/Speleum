import type { Metadata } from 'next'
import Script from 'next/script'
import { AuthProvider } from './auth/AuthProvider'
import { LanguageProvider } from '@/lib/i18n/LanguageProvider'
import { ThemeProvider } from '@/lib/theme/ThemeProvider'
import { defaultTheme, themeStorageKey } from '@/lib/theme/theme'
import { defaultLocale, languageStorageKey } from '@/lib/i18n/messages'
import { AudioProvider } from '@/lib/audio/AudioProvider'
import './globals.css'

export const metadata: Metadata = {
  title: 'Speleum | Supervivencia en cuevas',
  description: 'Juego web de supervivencia en cuevas con vision limitada, radar de senales, combate, ranking y persistencia.',
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
        <Script id="speleum-language-init" strategy="beforeInteractive">
          {`(() => {
            try {
              const stored = window.localStorage.getItem(${JSON.stringify(languageStorageKey)});
              document.documentElement.lang = stored === "en" || stored === "es" ? stored : ${JSON.stringify(defaultLocale)};
            } catch {
              document.documentElement.lang = ${JSON.stringify(defaultLocale)};
            }
          })();`}
        </Script>
        <ThemeProvider>
          <LanguageProvider>
            <AudioProvider>
              <AuthProvider>{children}</AuthProvider>
            </AudioProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
