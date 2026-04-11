import type { Metadata } from 'next'
import './globals.css'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'

export const metadata: Metadata = {
  title: 'Nexus Trade — 短期トレード分析システム',
  description: '日米株の短期トレード特化型シグナル配信システム',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang='ja'>
      <body className='h-screen flex overflow-hidden'>
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
