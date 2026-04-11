import type { Metadata, Viewport } from 'next'
import './globals.css'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
import PwaRegister from '@/components/layout/PwaRegister'

export const metadata: Metadata = {
  title: 'Nexus Trade — 短期トレード分析システム',
  description: '日米株の短期トレード特化型シグナル配信システム',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'NexusTrade',
  },
  icons: {
    apple: '/icons/icon.svg',
  },
}

export const viewport: Viewport = {
  themeColor: '#58a6ff',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang='ja'>
      <body className='h-screen flex overflow-hidden'>
        <PwaRegister />
        <Sidebar />
        <div className='flex-1 flex flex-col overflow-hidden'>
          <Header />
          <main className='flex-1 overflow-y-auto p-4'>
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
