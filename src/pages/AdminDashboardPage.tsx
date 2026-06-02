import { useNavigate } from 'react-router-dom'
import { LogOut, Newspaper, RefreshCw } from 'lucide-react'
import { useMarketStore } from '../stores/marketStore'
import { useGameStore } from '../stores/gameStore'
import { usePortfolioStore } from '../stores/portfolioStore'
import { generateQuarterNews } from '../engines/newsEngine'
import { useQuarterAdvance } from '../hooks/useQuarterAdvance'
import AppShell from '../components/layout/AppShell'
import { useState } from 'react'

const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`

function pctColor(n: number) {
  if (n > 0) return 'text-red-600'
  if (n < 0) return 'text-blue-600'
  return 'text-gray-900'
}
function pctColorSub(n: number) {
  if (n > 0) return 'text-red-600'
  if (n < 0) return 'text-blue-600'
  return 'text-gray-400'
}

const SECTOR_ORDER = ['기술', '교육', '금융', '물류', '게임']

export default function AdminDashboardPage() {
  const navigate       = useNavigate()
  const stocks         = useMarketStore(s => s.stocks)
  const currentNews    = useMarketStore(s => s.currentNews)
  const newsLoading    = useMarketStore(s => s.newsLoading)
  const setNews        = useMarketStore(s => s.setNews)
  const setNewsLoading = useMarketStore(s => s.setNewsLoading)
  const currentYear    = useGameStore(s => s.currentYear)
  const currentQuarter = useGameStore(s => s.currentQuarter)
  const apiKey         = useGameStore(s => s.apiKey)
  const isReady        = useGameStore(s => s.isReady())
  const cash        = usePortfolioStore(s => s.cash)
  const positions   = usePortfolioStore(s => s.positions)
  const lastFlipped        = useMarketStore(s => s.lastFlipped)
  const lastFlippedArticle = useMarketStore(s => s.lastFlippedArticle)
  const { advance, isAdvancing, advanceError } = useQuarterAdvance()

  const [retryError, setRetryError] = useState<string | null>(null)
  const [activeTab,  setActiveTab]  = useState<string>('요약')

  const handleRetry = async () => {
    if (!apiKey) return
    setRetryError(null)
    setNewsLoading(true)
    try {
      const news = await generateQuarterNews(apiKey, currentYear, currentQuarter, stocks)
      setNews(news)
    } catch (err) {
      setRetryError(err instanceof Error ? err.message : '뉴스 생성에 실패했습니다.')
    } finally {
      setNewsLoading(false)
    }
  }

  // 종목별 priceImpact 합산
  const impactMap: Record<string, number> = {}
  for (const article of currentNews) {
    for (const [symbol, pct] of Object.entries(article.priceImpact)) {
      impactMap[symbol] = (impactMap[symbol] ?? 0) + pct
    }
  }

  // 해당 종목에만 직접 영향을 주는 로컬 기사 (targetType === 'local' 인 기사만)
  function getLocalContributions(stockId: string) {
    return currentNews
      .filter(a => a.targetType === 'local' && a.priceImpact[stockId] !== undefined)
      .map(a => ({ id: a.id, headline: a.headline, impact: a.priceImpact[stockId] }))
  }

  // 영향 여부와 무관하게 전체 종목 포함 (0.0% 표기)
  const impactRows = stocks.map(s => ({ ...s, impact: impactMap[s.id] ?? 0 }))

  const sectorGroups = SECTOR_ORDER.map(sector => {
    const rows           = impactRows.filter(r => r.sector === sector)
    const sectorStockIds = stocks.filter(s => s.sector === sector).map(s => s.id)

    const globalArticles = currentNews.filter(a => {
      const explicit = a.targetType === 'global' && a.targetSector === sector
      const inferred = sectorStockIds.length > 0 &&
        sectorStockIds.every(id => a.priceImpact[id] !== undefined)
      return explicit || inferred
    })

    const sectorImpact = globalArticles.reduce((sum, article) => {
      const vals = sectorStockIds
        .map(id => article.priceImpact[id])
        .filter((v): v is number => v !== undefined)
      return sum + (vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : 0)
    }, 0)

    return { sector, rows, sectorImpact, globalArticles }
  })

  const sentimentLabel = (s: string) =>
    s === 'bullish' ? '긍정 ↑' : s === 'bearish' ? '부정 ↓' : '중립 →'
  const sentimentCls = (s: string) =>
    s === 'bullish'  ? 'bg-red-100 text-red-600'
    : s === 'bearish' ? 'bg-blue-100 text-blue-600'
    : 'bg-gray-100 text-gray-500'

  // 탭 목록 (영향 있는 섹터 + 뉴스)
  const allTabs = ['요약', ...SECTOR_ORDER, '뉴스']
  const currentGroup = sectorGroups.find(g => g.sector === activeTab)

  return (
    <AppShell isAdvancing={isAdvancing} onAdvance={advance} advanceError={advanceError}>
      <div className="h-full flex flex-col">

        {/* 헤더 */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-3 shrink-0">
          <span className="text-gray-600 font-semibold text-sm">
            🔒 Admin · YEAR {currentYear} Q{currentQuarter}
          </span>
          <button
            onClick={() => { useGameStore.getState().setAdminAuth(false); navigate('/admin') }}
            className="flex items-center gap-2 text-gray-400 hover:text-gray-900 text-sm transition-colors"
          >
            <LogOut size={14} />
            로그아웃
          </button>
        </div>

        {/* 로딩 / 에러 / 미시작 상태 */}
        {(!isReady || newsLoading || (!newsLoading && currentNews.length === 0)) && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            {!isReady && (
              <>
                <Newspaper size={40} className="text-gray-300" />
                <p className="text-gray-500 text-sm">게임을 먼저 시작해주세요.</p>
                <button onClick={() => navigate('/setup')} className="text-emerald-600 text-sm hover:text-emerald-500 transition-colors">
                  Setup으로 이동 →
                </button>
              </>
            )}
            {isReady && newsLoading && (
              <>
                <RefreshCw size={32} className="animate-spin text-emerald-400" />
                <p className="text-gray-500 text-sm">뉴스를 생성하는 중...</p>
              </>
            )}
            {isReady && !newsLoading && currentNews.length === 0 && (
              <>
                <Newspaper size={40} className="text-gray-300" />
                <p className="text-gray-500 text-sm">이번 분기 뉴스 데이터가 없습니다.</p>
                {retryError && <p className="text-red-600 text-xs max-w-sm text-center">{retryError}</p>}
                <button onClick={handleRetry} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm transition-colors">
                  <RefreshCw size={14} />
                  뉴스 다시 생성
                </button>
              </>
            )}
          </div>
        )}

        {isReady && !newsLoading && currentNews.length > 0 && (
          <div className="flex-1 flex flex-col min-h-0">

            {/* 탭 바 */}
            <div className="flex items-center gap-1 px-4 pt-3 pb-0 border-b border-gray-200 shrink-0 overflow-x-auto">
              {allTabs.map(tab => {
                const group  = sectorGroups.find(g => g.sector === tab)
                const impact = group?.sectorImpact ?? 0
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t border-b-2 transition-colors whitespace-nowrap ${
                      activeTab === tab
                        ? 'border-emerald-600 text-gray-900 bg-gray-100'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {tab}
                    {tab !== '뉴스' && tab !== '요약' && (
                      <span className={`text-xs font-semibold ${pctColor(impact)}`}>
                        {fmtPct(impact)}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* 탭 콘텐츠 */}
            <div className="flex-1 overflow-y-auto p-4">

              {/* 요약 탭 */}
              {activeTab === '요약' && (() => {
                const fmt  = (n: number) => `₩${Math.round(n).toLocaleString('ko-KR')}`

                // 전체 종목 예상 변동 정렬
                const ranked = stocks.map(s => {
                  const change = impactMap[s.id] ?? 0
                  const expectedPrice = Math.max(100, Math.round(s.currentPrice * (1 + change / 100) / 100) * 100)
                  return { ...s, change, expectedPrice }
                }).sort((a, b) => b.change - a.change)

                const NOISE = 8
                const upSectors = sectorGroups.filter(g => g.sectorImpact > 2).sort((a, b) => b.sectorImpact - a.sectorImpact)
                const downSectors = sectorGroups.filter(g => g.sectorImpact < -2).sort((a, b) => a.sectorImpact - b.sectorImpact)

                // 추천 종목 Top 5 (상승 예상)
                const top5 = ranked.filter(s => s.change > 0).slice(0, 5).map(s => {
                  const mainDriver = currentNews
                    .filter(a => (a.priceImpact[s.id] ?? 0) > 0)
                    .sort((a, b) => (b.priceImpact[s.id] ?? 0) - (a.priceImpact[s.id] ?? 0))[0]
                  return { ...s, reasoning: mainDriver?.headline ?? null }
                })

                return (
                  <div className="flex flex-col gap-5">

                    {/* 위험 요소 배너 */}
                    {(lastFlipped && lastFlippedArticle
                        ? (() => {
                            const a = lastFlippedArticle
                            const flippedEntries = Object.entries(a.priceImpact)
                            return (
                              <div className="rounded-xl border border-yellow-300 bg-yellow-50 overflow-hidden">
                                {/* 헤더 */}
                                <div className="flex items-center gap-2 px-4 py-2.5 bg-yellow-100 border-b border-yellow-300">
                                  <span className="text-lg">⚠️</span>
                                  <span className="text-yellow-800 font-bold text-sm">주가 상승/하락 반전 발동</span>
                                  <span className="text-yellow-600 text-xs ml-auto">기사별 1/6 확률 · 분기당 최대 1회</span>
                                </div>

                                <div className="px-4 py-3 flex flex-col gap-3">
                                  {/* ① 반전된 기사 */}
                                  <div>
                                    <p className="text-yellow-700 text-xs font-semibold uppercase tracking-wide mb-1">① 반전된 기사</p>
                                    <div className="bg-white border border-yellow-200 rounded-lg px-3 py-2">
                                      <p className="text-gray-800 text-sm font-semibold leading-snug">{a.headline}</p>
                                      {a.subheadline && (
                                        <p className="text-gray-500 text-xs mt-0.5 leading-snug">{a.subheadline}</p>
                                      )}
                                    </div>
                                  </div>

                                  {/* ② 영향 받는 종목 */}
                                  {flippedEntries.length > 0 && (
                                    <div>
                                      <p className="text-yellow-700 text-xs font-semibold uppercase tracking-wide mb-1">② 영향 종목 — 방향 반전</p>
                                      <div className="flex flex-col gap-1">
                                        {flippedEntries.map(([symbol, orig]) => {
                                          const reversed = -orig
                                          const st = stocks.find(s => s.id === symbol)
                                          return (
                                            <div key={symbol} className="bg-white border border-yellow-200 rounded-lg px-3 py-2 flex items-center justify-between">
                                              <div className="flex items-center gap-2">
                                                <span className="text-emerald-600 font-bold text-sm">{symbol}</span>
                                                {st && <span className="text-gray-600 text-xs">{st.name}</span>}
                                                {st && <span className="text-gray-400 text-xs">{st.sector}</span>}
                                              </div>
                                              <div className="flex items-center gap-2 text-xs">
                                                <span className={`${orig >= 0 ? 'text-red-400' : 'text-blue-400'} line-through`}>
                                                  {orig >= 0 ? '+' : ''}{orig.toFixed(1)}%
                                                </span>
                                                <span className="text-gray-400">→</span>
                                                <span className={`font-bold text-sm ${reversed >= 0 ? 'text-red-600' : 'text-blue-600'}`}>
                                                  {reversed >= 0 ? '+' : ''}{reversed.toFixed(1)}%
                                                </span>
                                              </div>
                                            </div>
                                          )
                                        })}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )
                          })()
                        : (
                          <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 border border-gray-300 rounded-xl text-gray-500 text-sm">
                            <span>🎲</span>
                            <span className="font-medium">주가 상승/하락 반전 미발동</span>
                            <span className="text-xs text-gray-400 ml-auto">전 기사 정상 적용</span>
                          </div>
                        )
                    )}

                    {/* 투자 조언 — 3열 컴팩트 */}
                    <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                      <div className="px-4 py-2.5 bg-gray-100 border-b border-gray-200 flex items-center justify-between">
                        <span className="text-gray-800 font-bold text-sm">투자 조언</span>
                        <span className="text-gray-400 text-xs">±{NOISE}% noise 미적용</span>
                      </div>
                      <div className="grid grid-cols-3 divide-x divide-gray-200">

                        {/* ① 강세 분야 */}
                        <div className="p-3 flex flex-col gap-1.5">
                          <p className="text-red-600 text-xs font-semibold mb-1">① 강세 분야</p>
                          {upSectors.length > 0 ? upSectors.map(g => (
                            <div key={g.sector} className="flex items-center justify-between bg-red-50 border border-red-200 rounded px-2 py-1.5">
                              <span className="text-gray-700 text-xs font-semibold">{g.sector}</span>
                              <span className="text-red-600 text-xs font-bold">{fmtPct(g.sectorImpact)}</span>
                            </div>
                          )) : (
                            <p className="text-gray-400 text-xs">강세 섹터 없음</p>
                          )}
                        </div>

                        {/* ② 약세 분야 */}
                        <div className="p-3 flex flex-col gap-1.5">
                          <p className="text-blue-600 text-xs font-semibold mb-1">② 약세 분야</p>
                          {downSectors.length > 0 ? downSectors.map(g => (
                            <div key={g.sector} className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded px-2 py-1.5">
                              <span className="text-gray-700 text-xs font-semibold">{g.sector}</span>
                              <span className="text-blue-600 text-xs font-bold">{fmtPct(g.sectorImpact)}</span>
                            </div>
                          )) : (
                            <p className="text-gray-400 text-xs">약세 섹터 없음</p>
                          )}
                        </div>

                        {/* ③ 추천 종목 Top 5 */}
                        <div className="p-3 flex flex-col gap-1.5">
                          <p className="text-emerald-600 text-xs font-semibold mb-1">③ 추천 종목 Top 5</p>
                          {top5.length > 0 ? top5.map((s, i) => (
                            <div key={s.id} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded px-2 py-1.5">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="text-gray-400 text-xs shrink-0">#{i + 1}</span>
                                <span className="text-emerald-600 font-bold text-xs shrink-0">{s.id}</span>
                                <span className="text-gray-500 text-xs truncate">{s.name}</span>
                              </div>
                              <span className="text-red-600 text-xs font-bold shrink-0 ml-2">{fmtPct(s.change)}</span>
                            </div>
                          )) : (
                            <p className="text-gray-400 text-xs">상승 예상 종목 없음</p>
                          )}
                        </div>

                      </div>
                    </section>

                    {/* 전체 종목 예상 변동 — 상승/하락 2블록 */}
                    {(() => {
                      const rising  = ranked.filter(s => s.change > 0)
                      const falling = ranked.filter(s => s.change < 0).reverse()

                      const StockRow = ({ s }: { s: typeof ranked[0] }) => (
                        <div className="grid grid-cols-[3.5rem_1fr_3.5rem_5rem] px-3 py-2 items-center border-b border-gray-100 last:border-0 text-xs">
                          <span className="text-emerald-600 font-bold">{s.id}</span>
                          <div>
                            <span className="text-gray-700">{s.name}</span>
                            <span className="text-gray-400 ml-1.5">{s.sector}</span>
                          </div>
                          <span className="text-right text-gray-400">{fmt(s.currentPrice)}</span>
                          <span className={`text-right font-bold ${pctColor(s.change)}`}>{fmtPct(s.change)}</span>
                        </div>
                      )

                      return (
                        <section className="grid grid-cols-2 gap-4">
                          {/* 상승 */}
                          <div className="bg-white border border-red-200 rounded-xl overflow-hidden">
                            <div className="px-3 py-2.5 bg-red-50 border-b border-red-200 flex items-center justify-between">
                              <span className="text-red-600 font-bold text-sm">상승 예상</span>
                              <span className="text-red-400 text-xs">{rising.length}종목</span>
                            </div>
                            {rising.length > 0
                              ? rising.map(s => <StockRow key={s.id} s={s} />)
                              : <p className="text-gray-400 text-xs px-3 py-3">해당 없음</p>
                            }
                          </div>

                          {/* 하락 */}
                          <div className="bg-white border border-blue-200 rounded-xl overflow-hidden">
                            <div className="px-3 py-2.5 bg-blue-50 border-b border-blue-200 flex items-center justify-between">
                              <span className="text-blue-600 font-bold text-sm">하락 예상</span>
                              <span className="text-blue-400 text-xs">{falling.length}종목</span>
                            </div>
                            {falling.length > 0
                              ? falling.map(s => <StockRow key={s.id} s={s} />)
                              : <p className="text-gray-400 text-xs px-3 py-3">해당 없음</p>
                            }
                          </div>
                        </section>
                      )
                    })()}


                  </div>
                )
              })()}

              {/* 섹터 탭 */}
              {activeTab !== '뉴스' && activeTab !== '요약' && (
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">

                  {/* 섹터 타이틀 */}
                  <div className="px-4 py-2.5 bg-gray-100 border-b border-gray-200">
                    <span className="text-gray-800 font-bold text-sm">{activeTab} 섹터</span>
                  </div>

                  {/* 컬럼 헤더 */}
                  <div className="grid grid-cols-[9rem_5rem_1fr_8rem] items-center px-4 py-2 border-b border-gray-300 text-gray-400 text-xs">
                    <span>종목</span>
                    <span className="text-right">영향</span>
                    <span className="px-3">기사</span>
                    <span className="text-right">총 누적 예상 변동</span>
                  </div>

                  {/* 전체 영향 행 (항상 표시) */}
                  <div className="grid grid-cols-[9rem_5rem_1fr_8rem] items-start px-4 py-2.5 border-b border-gray-200 bg-gray-100">
                    <span className="text-gray-500 text-xs font-semibold">전체 영향</span>
                    <span className={`text-right text-xs font-bold ${pctColor(currentGroup?.sectorImpact ?? 0)}`}>
                      {fmtPct(currentGroup?.sectorImpact ?? 0)}
                    </span>
                    <div className="px-3 flex flex-col gap-0.5">
                      {currentGroup?.globalArticles.map(a => (
                        <span key={a.id} className="text-gray-400 text-xs leading-snug">{a.headline}</span>
                      ))}
                    </div>
                    <span />
                  </div>

                  {/* 종목 행 (해당 섹터 전체 종목 표시) */}
                  {(currentGroup?.rows ?? stocks.filter(s => s.sector === activeTab).map(s => ({ ...s, impact: 0 }))).map(row => {
                      const localContribs  = getLocalContributions(row.id)
                      const localImpact    = localContribs.reduce((s, c) => s + c.impact, 0)
                      const globalImpact   = row.impact - localImpact

                      return (
                        <div key={row.id} className="grid grid-cols-[9rem_5rem_1fr_8rem] items-start px-4 py-2.5 border-b border-gray-200 last:border-0 hover:bg-gray-50 transition-colors">
                          {/* 종목 */}
                          <div>
                            <div className="text-emerald-600 font-bold text-xs">{row.id}</div>
                            <div className="text-gray-500 text-xs">{row.name}</div>
                          </div>

                          {/* 영향 % (합산) */}
                          <div className={`text-right font-bold text-xs ${pctColor(row.impact)}`}>
                            {fmtPct(row.impact)}
                          </div>

                          {/* 직접 영향 기사만 표시 (없으면 빈칸) */}
                          <div className="px-3 flex flex-col gap-0.5">
                            {localContribs.length > 0 ? localContribs.map(c => (
                              <div key={c.id} className="flex items-start gap-1.5">
                                <span className={`text-xs font-semibold shrink-0 w-10 text-right ${pctColor(c.impact)}`}>
                                  {c.impact >= 0 ? '+' : ''}{c.impact.toFixed(1)}%
                                </span>
                                <span className="text-gray-400 text-xs leading-snug">{c.headline}</span>
                              </div>
                            )) : (
                              <span className="text-gray-300 text-xs">-</span>
                            )}
                          </div>

                          {/* 총 누적 예상 변동: 전체영향 + 종목영향 = 총변동 */}
                          <div className="flex flex-col gap-0.5 text-xs text-right">
                            {Math.abs(globalImpact) > 0.05 && (
                              <span className={pctColorSub(globalImpact)}>
                                전체 {fmtPct(globalImpact)}
                              </span>
                            )}
                            {Math.abs(localImpact) > 0.05 && (
                              <span className={pctColorSub(localImpact)}>
                                종목 {fmtPct(localImpact)}
                              </span>
                            )}
                            <span className={`font-bold border-t border-gray-300 pt-0.5 mt-0.5 ${pctColor(row.impact)}`}>
                              = {fmtPct(row.impact)}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                </div>
              )}

              {/* 뉴스 탭 */}
              {activeTab === '뉴스' && (
                <div className="flex flex-col gap-3">
                  {currentNews.map(article => {
                    const impacts = Object.entries(article.priceImpact)
                    return (
                      <div key={article.id} className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-2.5">
                        <div className="flex items-start gap-3 flex-wrap">
                          <span className="text-gray-700 text-sm font-medium flex-1 min-w-0">{article.headline}</span>
                          <span className={`text-xs px-2 py-0.5 rounded font-medium shrink-0 ${sentimentCls(article.sentiment)}`}>
                            {sentimentLabel(article.sentiment)}
                          </span>
                        </div>
                        {article.summary && (
                          <p className="text-gray-500 text-xs leading-relaxed border-l-2 border-gray-300 pl-3">
                            {article.summary}
                          </p>
                        )}
                        {impacts.length > 0 ? (
                          <div className="flex gap-1.5 flex-wrap">
                            {impacts.map(([symbol, pct]) => (
                              <span
                                key={symbol}
                                className={`text-xs px-2 py-0.5 rounded border ${
                                  pct > 0  ? 'border-red-300 text-red-600 bg-red-50'
                                  : pct < 0 ? 'border-blue-300 text-blue-600 bg-blue-50'
                                  : 'border-gray-300 text-gray-900 bg-gray-100'
                                }`}
                              >
                                {symbol} {fmtPct(pct)}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-gray-400 text-xs">영향 종목 없음</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
