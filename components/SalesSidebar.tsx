'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Users, FileText, Home } from 'lucide-react'
import { cn } from '@/lib/utils'

const BRAND = '#db291b'

const navItems = [
  { href: '/sales', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/sales/contatti', label: 'Contatti', icon: Users },
  { href: '/sales/preventivi', label: 'Preventivi', icon: FileText },
]

export default function SalesSidebar() {
  const pathname = usePathname()

  return (
    <aside
      className="fixed left-0 top-0 h-screen w-60 flex flex-col z-50"
      style={{ background: '#000000' }}
    >
      <div className="px-6 py-5 border-b border-[#222222]">
        <div className="flex items-center gap-3 mb-3">
          <div
            className="rounded-full bg-white flex items-center justify-center shrink-0"
            style={{ width: 52, height: 52 }}
          >
            <img
              src="/WAKE UP! labs - LOGO.png"
              alt="Wake Up Labs"
              style={{ width: 40, height: 40, objectFit: 'contain' }}
            />
          </div>
          <div>
            <p className="text-xs font-medium leading-tight" style={{ color: '#ffffff' }}>Anda Agencia de</p>
            <p className="text-xs font-medium leading-tight" style={{ color: '#ffffff' }}>Publicidad SL</p>
          </div>
        </div>
        <div className="pt-3 border-t border-[#222222]">
          <p className="text-xs font-medium" style={{ color: BRAND }}>CEO Dashboard</p>
          <p className="text-xs" style={{ color: '#888888' }}>Lorenzo Vanghetti</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
                active ? 'text-white shadow-md' : 'hover:text-white'
              )}
              style={active ? { background: BRAND } : { color: '#fca5a5' }}
              onMouseEnter={e => {
                if (!active) (e.currentTarget as HTMLElement).style.background = '#1a1a1a'
              }}
              onMouseLeave={e => {
                if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'
              }}
            >
              <Icon size={18} className="shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Home button */}
      <div className="px-3 pt-2 border-t border-[#222222]">
        <Link
          href="/"
          className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-150"
          style={{ color: '#555555' }}
          onMouseEnter={e => {
            ;(e.currentTarget as HTMLElement).style.color = '#ffffff'
            ;(e.currentTarget as HTMLElement).style.background = '#1a1a1a'
          }}
          onMouseLeave={e => {
            ;(e.currentTarget as HTMLElement).style.color = '#555555'
            ;(e.currentTarget as HTMLElement).style.background = 'transparent'
          }}
        >
          <Home size={18} className="shrink-0" />
          Home
        </Link>
      </div>

      <div className="px-6 py-4">
        <p className="text-xs" style={{ color: '#555555' }}>
          © 2025 Anda Agencia de Publicidad SL
        </p>
      </div>
    </aside>
  )
}
