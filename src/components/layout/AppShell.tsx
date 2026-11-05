import { ReactNode } from 'react'
import NavBar from './NavBar'
import QuarterResultModal from '../modals/QuarterResultModal'
import TimeoutNoticeModal from '../modals/TimeoutNoticeModal'
import FinalResultModal from '../modals/FinalResultModal'
import RoundWaitBanner from './RoundWaitBanner'

interface AppShellProps {
  children: ReactNode
  isAdvancing?: boolean
  onAdvance?: () => void
  advanceError?: string | null
  /** true 이면 화면 높이를 꽉 채우고 내용 영역 안에서만 스크롤 (거래 화면) */
  fill?: boolean
}

export default function AppShell({ children, isAdvancing, onAdvance, advanceError, fill = false }: AppShellProps) {
  return (
    <div className={`${fill ? 'h-screen' : 'min-h-screen'} bg-paper text-ink flex flex-col`}>
      <NavBar isAdvancing={isAdvancing} onAdvance={onAdvance} advanceError={advanceError} />
      <RoundWaitBanner />
      <main className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {children}
      </main>
      <footer className="shrink-0 border-t border-ink py-3 px-6 flex items-center justify-center">
        <span className="text-mute text-xs">© 2026 aishift. All rights reserved.</span>
      </footer>
      <QuarterResultModal />
      <TimeoutNoticeModal />
      <FinalResultModal />
    </div>
  )
}
