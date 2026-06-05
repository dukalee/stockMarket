import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TrendingUp, Eye, EyeOff, CircleAlert, Loader2 } from 'lucide-react'
import logoUrl from '../../logo.png'
import { useGameStore } from '../stores/gameStore'
import { usePortfolioStore } from '../stores/portfolioStore'
import { useMarketStore } from '../stores/marketStore'
import { generateQuarterNews } from '../engines/newsEngine'

const CAPITAL_PRESETS = [
  { label: '100만',  value: 1_000_000 },
  { label: '500만',  value: 5_000_000 },
  { label: '1000만', value: 10_000_000 },
  { label: '5000만', value: 50_000_000 },
]

function formatCapital(n: number) {
  if (n >= 100_000_000) return `₩${(n / 100_000_000).toFixed(0)}억`
  if (n >= 10_000)      return `₩${(n / 10_000).toFixed(0)}만`
  return `₩${n.toLocaleString('ko-KR')}`
}

export default function SetupPage() {
  const navigate = useNavigate()
  const startGame      = useGameStore(s => s.startGame)
  const initPortfolio  = usePortfolioStore(s => s.init)
  const stocks                   = useMarketStore(s => s.stocks)
  const setNews                  = useMarketStore(s => s.setNews)
  const setNewsLoading           = useMarketStore(s => s.setNewsLoading)
  const setNewsLoadingProgress   = useMarketStore(s => s.setNewsLoadingProgress)

  const [userName,     setUserName]     = useState('')
  const [apiKey,       setApiKey]       = useState('')
  const [capitalInput, setCapitalInput] = useState('10000000')
  const [showKey,      setShowKey]      = useState(false)
  const [errors,       setErrors]       = useState<Record<string, string>>({})
  const [starting,     setStarting]     = useState(false)

  const capital = Number(capitalInput.replace(/,/g, '')) || 0

  const validate = () => {
    const e: Record<string, string> = {}
    if (!userName.trim())               e.userName = '이름을 입력해주세요.'
    if (!apiKey.trim())                 e.apiKey   = 'API Key를 입력해주세요.'
    else if (!apiKey.startsWith('sk-')) e.apiKey   = 'sk- 로 시작하는 유효한 키를 입력해주세요.'
    if (!capital || capital < 100_000)  e.capital  = '최소 ₩100,000 이상 입력해주세요.'
    return e
  }

  const handleStart = async () => {
    const e = validate()
    if (Object.keys(e).length > 0) { setErrors(e); return }

    setStarting(true)
    setNewsLoading(true)
    setNewsLoadingProgress(0)

    startGame(userName.trim(), apiKey.trim(), capital)
    initPortfolio(capital)

    try {
      const news = await generateQuarterNews(apiKey.trim(), 1, 1, stocks, setNewsLoadingProgress)
      setNews(news)
    } catch (err) {
      const msg = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.'
      setErrors(prev => ({ ...prev, general: `뉴스 생성 실패 — ${msg}` }))
      return
    } finally {
      setNewsLoadingProgress(8)
      setNewsLoading(false)
      setStarting(false)
      setTimeout(() => setNewsLoadingProgress(0), 400)
    }

    navigate('/')
  }

  const handleCapitalInput = (val: string) => {
    setCapitalInput(val.replace(/[^0-9]/g, ''))
    setErrors(prev => ({ ...prev, capital: '' }))
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-mono flex flex-col px-4">
      <div className="flex-1 flex flex-col items-center justify-center">
      <div className="flex items-center gap-3 mb-2">
        <TrendingUp size={32} className="text-emerald-600" />
        <span className="text-3xl font-bold text-emerald-600">MincoStocks</span>
      </div>
      <p className="text-gray-400 text-sm mb-10">가상 주식 거래 시뮬레이터</p>

      <div className="w-full max-w-md bg-white border border-gray-200 rounded-xl p-8 flex flex-col gap-6">

        <Field label="이름" error={errors.userName}>
          <input
            type="text"
            value={userName}
            onChange={e => { setUserName(e.target.value); setErrors(p => ({ ...p, userName: '' })) }}
            placeholder="홍길동"
            className={inputCls(!!errors.userName)}
          />
        </Field>

        <Field label="OpenAI API Key" error={errors.apiKey}>
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={e => { setApiKey(e.target.value); setErrors(p => ({ ...p, apiKey: '' })) }}
              placeholder="sk-..."
              className={`${inputCls(!!errors.apiKey)} pr-11`}
            />
            <button
              type="button"
              onClick={() => setShowKey(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </Field>

        <Field label="초기 자본" error={errors.capital}>
          <div className="flex gap-2 mb-2">
            {CAPITAL_PRESETS.map(p => (
              <button
                key={p.value}
                type="button"
                onClick={() => { setCapitalInput(String(p.value)); setErrors(prev => ({ ...prev, capital: '' })) }}
                className={`flex-1 py-1.5 rounded text-xs font-medium border transition-colors ${
                  capital === p.value
                    ? 'bg-emerald-700 border-emerald-600 text-white'
                    : 'bg-gray-100 border-gray-300 text-gray-500 hover:border-gray-400 hover:text-gray-700'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₩</span>
            <input
              type="text"
              inputMode="numeric"
              value={capitalInput ? Number(capitalInput).toLocaleString('ko-KR') : ''}
              onChange={e => handleCapitalInput(e.target.value)}
              placeholder="100,000,000"
              className={`${inputCls(!!errors.capital)} pl-8`}
            />
          </div>
          {capital >= 1_000_000 && (
            <p className="text-gray-400 text-xs mt-1">{formatCapital(capital)}으로 시작</p>
          )}
        </Field>

        <hr className="border-gray-200" />

        {errors.general && (
          <p className="flex items-center gap-1.5 text-red-600 text-xs">
            <CircleAlert size={12} />
            {errors.general}
          </p>
        )}

        <button
          onClick={handleStart}
          disabled={starting}
          className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold transition-colors"
        >
          {starting ? (
            <div className="flex items-center justify-center gap-2 px-4 py-3 text-sm">
              <Loader2 size={14} className="animate-spin" />
              loading...
            </div>
          ) : (
            <span className="block py-3">주식 거래 시작하기 →</span>
          )}
        </button>
      </div>
      </div>

      <footer className="shrink-0 border-t border-gray-100 py-3 flex items-center justify-center gap-3">
        <img src={logoUrl} alt="logo" className="h-6 w-auto opacity-60" />
        <span className="text-gray-400 text-xs">© All rights reserved</span>
      </footer>
    </div>
  )
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-gray-600 text-sm">{label}</label>
      {children}
      {error && (
        <p className="flex items-center gap-1.5 text-red-600 text-xs">
          <CircleAlert size={12} />
          {error}
        </p>
      )}
    </div>
  )
}

function inputCls(hasError: boolean) {
  return `w-full bg-white border rounded-lg px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none transition-colors ${
    hasError ? 'border-red-500 focus:border-red-400' : 'border-gray-300 focus:border-emerald-500'
  }`
}
