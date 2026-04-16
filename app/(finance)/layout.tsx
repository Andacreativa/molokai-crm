import Sidebar from '@/components/Sidebar'
import Providers from '@/components/Providers'

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">
      <Providers>
        <Sidebar />
        <main className="flex-1 md:ml-60 min-h-screen p-4 pt-14 md:p-8">
          {children}
        </main>
      </Providers>
    </div>
  )
}
