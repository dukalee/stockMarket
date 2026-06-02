import { ReactNode } from 'react'
import NavBar from './NavBar'
import QuarterResultModal from '../modals/QuarterResultModal'
import logoUrl from '../../../logo.png'

interface AppShellProps {
  children: ReactNode
  isAdvancing?: boolean
  onAdvance?: () => void
  advanceError?: string | null
}

export default function AppShell({ children, isAdvancing, onAdvance, advanceError }: AppShellProps) {
  return (
    <div className="min-h-screen bg-white text-gray-800 font-mono flex flex-col">
      <NavBar isAdvancing={isAdvancing} onAdvance={onAdvance} advanceError={advanceError} />
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
      <footer className="shrink-0 border-t border-gray-100 py-3 px-6 flex items-center justify-center gap-3">
        <img src={logoUrl} alt="logo" className="h-6 w-auto opacity-60" />
        <span className="text-gray-400 text-xs">© All rights reserved</span>
      </footer>
      <QuarterResultModal />
    </div>
  )
}
