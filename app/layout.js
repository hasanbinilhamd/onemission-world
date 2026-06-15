import './globals.css'
import { Providers } from './providers'
import { Inter } from 'next/font/google'
import PWARegister from '@/components/onemission/pwa-register'

const inter = Inter({ subsets: ['latin'], weight: ['400','500','600','700'], variable: '--font-inter' })

export const metadata = {
  title: 'ONEMISSION HQ — VALUES MATTER',
  description: 'The central operating system for ONEMISSION business operations.',
  manifest: '/manifest.json',
  applicationName: 'ONEMISSION HQ',
  appleWebApp: {
    capable: true,
    title: 'ONEMISSION HQ',
    statusBarStyle: 'black-translucent',
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
  themeColor: '#09090B',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`dark ${inter.variable}`} suppressHydrationWarning>
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="ONEMISSION HQ" />
        <script dangerouslySetInnerHTML={{__html:'window.addEventListener("error",function(e){if(e.error instanceof DOMException&&e.error.name==="DataCloneError"&&e.message&&e.message.includes("PerformanceServerTiming")){e.stopImmediatePropagation();e.preventDefault()}},true);'}} />
      </head>
      <body className={`${inter.className} antialiased`}>
        <Providers>{children}</Providers>
        <PWARegister />
      </body>
    </html>
  )
}
