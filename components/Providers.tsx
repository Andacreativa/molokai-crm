'use client'

import { AnnoProvider } from '@/lib/anno-context'

export default function Providers({ children }: { children: React.ReactNode }) {
  return <AnnoProvider>{children}</AnnoProvider>
}
