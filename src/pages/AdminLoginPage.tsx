import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { useGameStore } from '../stores/gameStore'
import { isContestServerConfigured } from '../lib/supabase'
import { adminListContests, ContestError } from '../services/contest'
import { saveAdminKey } from '../utils/adminKey'
import AppShell from '../components/layout/AppShell'

/**
 * 관리자 로그인 = 관리자 키 확인.
 * 서버가 키를 검사한다 (키는 브라우저 코드에 없다). 관리자 화면은 대회 관리만 하므로 대회 서버가 없으면 쓸 수 없다.
 */
export default function AdminLoginPage() {
  const navigate     = useNavigate()
  const setAdminAuth = useGameStore(s => s.setAdminAuth)
  const [pw, setPw]  = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy]   = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await adminListContests(pw)            // 서버가 관리자 키를 확인한다 (틀리면 오류)
      saveAdminKey(pw)                        // 대회 관리 화면에서 다시 묻지 않도록 이 탭에만 보관
      setAdminAuth(true)
      navigate('/admin/contests')
    } catch (err) {
      setError(err instanceof ContestError ? err.message : '확인하지 못했습니다. 잠시 후 다시 시도해 주세요.')
      setPw('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AppShell>
      <div className="flex-1 min-h-0 flex items-center justify-center px-4 pt-16 pb-24">
        <div className="w-full max-w-sm flex flex-col items-center gap-6">
          <div className="flex flex-col items-center gap-2">
            <Lock size={32} className="text-ink" />
            <h1 className="font-serif text-lg font-black text-ink">관리자 전용 페이지</h1>
          </div>

          <form
            onSubmit={handleSubmit}
            className="w-full bg-paper-card border border-ink p-7 flex flex-col gap-5"
          >
            <div className="flex flex-col gap-2">
              <label className="text-mute text-sm font-bold">관리자 키</label>
              <input
                type="password"
                value={pw}
                onChange={e => { setPw(e.target.value); setError(null) }}
                placeholder="관리자 키를 입력하세요"
                autoComplete="off"
                autoFocus
                className={`bg-paper border min-h-10 px-4 py-2.5 text-ink placeholder:text-mute ${
                  error ? 'border-up' : 'border-ink'
                }`}
              />
              {error && <p className="text-up text-xs">{error}</p>}
              {!isContestServerConfigured && (
                <p className="text-up text-xs m-0">대회 서버가 설정되지 않아 관리자 기능을 쓸 수 없습니다.</p>
              )}
            </div>
            <button
              type="submit"
              disabled={busy || !pw || !isContestServerConfigured}
              className="w-full min-h-10 py-2.5 bg-ink text-paper font-bold text-sm hover:bg-ink-soft disabled:opacity-40"
            >
              {busy ? '확인 중…' : '확인'}
            </button>
          </form>
        </div>
      </div>
    </AppShell>
  )
}
