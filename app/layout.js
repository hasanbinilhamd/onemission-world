import './globals.css'
import { Providers } from './providers'
import { Space_Grotesk } from 'next/font/google'
import PWARegister from '@/components/onemission/pwa-register'

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-space-grotesk',
})

export const metadata = {
  title: 'ONEMISSION HQ — VALUES MATTER',
  description: 'The central operating system for ONEMISSION business operations.',
  manifest: '/manifest.json',
  applicationName: 'ONEMISSION HQ',
  appleWebApp: {
    capable: true,
    title: 'ONEMISSION HQ',
    statusBarStyle: 'default',
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
    shortcut: '/favicon-32.png',
  },
}

export const viewport = {
  themeColor: '#F7F8FA',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={spaceGrotesk.variable} suppressHydrationWarning>
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="ONEMISSION HQ" />
        <script dangerouslySetInnerHTML={{__html:'window.addEventListener("error",function(e){if(e.error instanceof DOMException&&e.error.name==="DataCloneError"&&e.message&&e.message.includes("PerformanceServerTiming")){e.stopImmediatePropagation();e.preventDefault()}},true);'}} />
      </head>
      <body className={`${spaceGrotesk.className} antialiased`}>
        <Providers>{children}</Providers>
        <PWARegister />
      </body>
    </html>
  )
}
