import SalesSidebar from '@/components/SalesSidebar'

export default function SalesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="sales-bg min-h-screen flex">
      <SalesSidebar />
      <main className="flex-1 ml-60 min-h-screen p-8">
        {children}
      </main>
    </div>
  )
}
