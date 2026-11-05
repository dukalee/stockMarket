import { useNavigate } from 'react-router-dom'
import { Loader2, Newspaper } from 'lucide-react'
import AppShell from '../components/layout/AppShell'
import { useMarketStore } from '../stores/marketStore'
import { useGameStore } from '../stores/gameStore'
import { useQuarterAdvance } from '../hooks/useQuarterAdvance'
import type { NewsArticle } from '../types'

/** 4 x 2 지면의 기사 한 칸. 열 사이는 세로선, 행 사이는 가로선으로 나눈다. */
function ArticleCell({
  article,
  sector,
  index,
  onClick,
}: {
  article: NewsArticle
  sector: string
  index: number
  onClick: () => void
}) {
  // 화면 폭에 따라 1열 -> 2열 -> 4열. 각 열 끝 칸에는 세로선을 그리지 않는다.
  const divider = `${index % 2 === 0 ? 'md:border-r' : 'md:border-r-0'} ${index % 4 === 3 ? 'lg:border-r-0' : 'lg:border-r'}`

  return (
    <button
      onClick={onClick}
      className={`text-left group h-full flex flex-col gap-2.5 px-5 py-5 border-b border-ink/30 border-r-ink/30 hover:bg-paper-deep transition-colors min-h-10 ${divider}`}
    >
      <p className="flex items-baseline justify-between text-xs m-0">
        <span className="text-up font-bold">{sector}</span>
        <span className="text-mute">
          {article.publishedAt ? article.publishedAt.split('  ')[0] : '—'}
        </span>
      </p>
      <h2 className="font-serif text-[17px] font-black text-ink leading-snug m-0 group-hover:underline">
        {article.headline}
      </h2>
      <p className="text-[13px] text-ink-soft leading-relaxed m-0 line-clamp-4">
        {article.subheadline}
      </p>
      <p className="text-mute text-xs m-0 mt-auto pt-1">{article.author}</p>
    </button>
  )
}

export default function NewsPage() {
  const navigate       = useNavigate()
  const currentNews    = useMarketStore(s => s.currentNews)
  const stocks         = useMarketStore(s => s.stocks)
  const newsLoading    = useMarketStore(s => s.newsLoading)
  const currentYear    = useGameStore(s => s.currentYear)
  const currentQuarter = useGameStore(s => s.currentQuarter)
  const { advance, isAdvancing, advanceError } = useQuarterAdvance()

  return (
    <AppShell isAdvancing={isAdvancing} onAdvance={advance} advanceError={advanceError}>
      <div className="h-full overflow-y-auto bg-paper">
        <div className="max-w-7xl mx-auto px-6 py-6">

          {/* Masthead */}
          <div className="text-center mb-1">
            <p className="text-mute text-xs tracking-widest uppercase mb-2">
              YEAR {currentYear} · Q{currentQuarter}
            </p>
            <h1 className="font-serif text-4xl font-black text-ink tracking-tight leading-none">
              AI Times
            </h1>
            <p className="text-ink-soft text-sm mt-2">Q{currentQuarter} 주요 소식</p>
          </div>
          <div className="border-t-4 border-double border-ink mt-4 mb-4" />

          {/* Loading */}
          {newsLoading && (
            <div className="flex flex-col items-center justify-center gap-4 py-24">
              <Loader2 size={32} className="animate-spin text-ink" />
              <p className="text-ink-soft text-sm">뉴스를 가져오는 중...</p>
            </div>
          )}

          {/* Empty */}
          {!newsLoading && currentNews.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-3 py-24">
              <Newspaper size={40} className="text-rule" />
              <p className="text-ink-soft text-sm">이번 분기 뉴스가 없습니다.</p>
              <p className="text-mute text-xs">분기를 진행하면 새 뉴스가 생성됩니다.</p>
            </div>
          )}

          {/* 기사 4 x 2 (한 분기 기사 8건) */}
          {!newsLoading && currentNews.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 border-t border-ink/30">
              {currentNews.map((article, i) => (
                <ArticleCell
                  key={article.id}
                  article={article}
                  sector={article.targetSector ?? stocks.find(st => st.id === article.affectedSymbols[0])?.sector ?? '경제'}
                  index={i}
                  onClick={() => navigate(`/news/${article.id}`)}
                />
              ))}
            </div>
          )}

        </div>
      </div>
    </AppShell>
  )
}
