import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { ADMIN_PASSWORD } from '../utils/constants'
import { useGameStore } from '../stores/gameStore'
import AppShell from '../components/layout/AppShell'

export default function AdminLoginPage() {
  const navigate     = useNavigate()
  const setAdminAuth = useGameStore(s => s.setAdminAuth)
  const [pw, setPw]  = useState('')
  const [error, setError] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (pw === ADMIN_PASSWORD) {
      setAdminAuth(true)
      navigate('/admin/dashboard')
    } else {
      setError(true)
      setPw('')
    }
  }

  return (
    <AppShell>
      <div className="h-full flex items-center justify-center px-4">
        <div className="w-full max-w-sm flex flex-col items-center gap-6">
          <div className="flex flex-col items-center gap-2">
            <Lock size={32} className="text-gray-500" />
            <h1 className="text-lg font-semibold text-gray-700">관리자 전용 페이지</h1>
          </div>

          <form
            onSubmit={handleSubmit}
            className="w-full bg-white border border-gray-200 rounded-xl p-7 flex flex-col gap-5"
          >
            <div className="flex flex-col gap-2">
              <label className="text-gray-500 text-sm">비밀번호</label>
              <input
                type="password"
                value={pw}
                onChange={e => { setPw(e.target.value); setError(false) }}
                placeholder="비밀번호를 입력하세요"
                autoFocus
                className={`bg-white border rounded-lg px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none transition-colors ${
                  error ? 'border-red-500 focus:border-red-400' : 'border-gray-300 focus:border-emerald-500'
                }`}
              />
              {error && <p className="text-red-600 text-xs">비밀번호가 올바르지 않습니다.</p>}
            </div>
            <button
              type="submit"
              className="w-full py-2.5 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-900 font-medium text-sm transition-colors"
            >
              확인
            </button>
          </form>
        </div>
      </div>
    </AppShell>
  )
}
