import { useNavigate } from 'react-router-dom'
import { Loader2, Newspaper } from 'lucide-react'
import AppShell from '../components/layout/AppShell'
import { useMarketStore } from '../stores/marketStore'
import { useGameStore } from '../stores/gameStore'
import { useQuarterAdvance } from '../hooks/useQuarterAdvance'
import type { NewsArticle } from '../types'

function ArticleRow({
  article,
  onClick,
}: {
  article: NewsArticle
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left group flex items-start gap-5 py-5 border-b border-gray-200 hover:bg-gray-50 transition-colors px-2 -mx-2 rounded"
    >
      {/* Date column */}
      <div className="w-20 shrink-0 pt-0.5">
        <p className="text-gray-400 text-xs leading-relaxed">
          {article.publishedAt ? article.publishedAt.split('  ')[0] : '—'}
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-emerald-700 text-xs font-semibold uppercase tracking-widest mb-1.5">
          {article.targetSector ?? '경제'}
        </p>
        <h2 className="text-sm font-bold text-gray-900 leading-snug mb-2 group-hover:text-gray-600 transition-colors">
          {article.headline}
        </h2>
        <p className="text-xs text-gray-500 leading-relaxed mb-2 line-clamp-2">
          {article.subheadline}
        </p>
        <p className="text-gray-400 text-xs">By {article.author}</p>
      </div>
    </button>
  )
}

export default function NewsPage() {
  const navigate       = useNavigate()
  const currentNews    = useMarketStore(s => s.currentNews)
  const newsLoading    = useMarketStore(s => s.newsLoading)
  const currentYear    = useGameStore(s => s.currentYear)
  const currentQuarter = useGameStore(s => s.currentQuarter)
  const { advance, isAdvancing, advanceError } = useQuarterAdvance()

  return (
    <AppShell isAdvancing={isAdvancing} onAdvance={advance} advanceError={advanceError}>
      <div className="h-full overflow-y-auto bg-white">
        <div className="max-w-3xl mx-auto px-6 py-6">

          {/* Masthead */}
          <div className="text-center mb-1">
            <p className="text-gray-400 text-xs tracking-widest uppercase mb-2">
              YEAR {currentYear} · Q{currentQuarter}
            </p>
            <h1 className="text-4xl font-bold text-gray-900 tracking-tight leading-none">
              MincoTimes
            </h1>
            <p className="text-gray-500 text-sm mt-2">Q{currentQuarter} 주요 소식</p>
          </div>
          <div className="border-t-2 border-gray-800 mt-4 mb-1" />
          <div className="border-t border-gray-300 mb-4" />

          {/* Loading */}
          {newsLoading && (
            <div className="flex flex-col items-center justify-center gap-4 py-24">
              <Loader2 size={32} className="animate-spin text-emerald-600" />
              <p className="text-gray-500 text-sm">뉴스를 가져오는 중...</p>
            </div>
          )}

          {/* Empty */}
          {!newsLoading && currentNews.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-3 py-24">
              <Newspaper size={40} className="text-gray-300" />
              <p className="text-gray-500 text-sm">이번 분기 뉴스가 없습니다.</p>
              <p className="text-gray-400 text-xs">분기를 진행하면 새 뉴스가 생성됩니다.</p>
            </div>
          )}

          {/* Article list */}
          {!newsLoading && currentNews.length > 0 && (
            <div>
              {currentNews.map((article) => (
                <ArticleRow
                  key={article.id}
                  article={article}
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
