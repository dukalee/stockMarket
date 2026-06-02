import { useParams, useNavigate } from 'react-router-dom'
import AppShell from '../components/layout/AppShell'
import { TrendingUp } from 'lucide-react'
import { useMarketStore } from '../stores/marketStore'

export default function NewsArticlePage() {
  const { id }      = useParams<{ id: string }>()
  const navigate    = useNavigate()
  const currentNews = useMarketStore(s => s.currentNews)
  const article     = currentNews.find(a => a.id === id)

  if (!article) {
    return (
      <AppShell>
        <div className="h-full flex items-center justify-center flex-col gap-3">
          <p className="text-gray-400 text-sm">기사를 찾을 수 없습니다.</p>
          <button
            onClick={() => navigate('/news')}
            className="text-emerald-400 text-sm hover:text-emerald-300 transition-colors"
          >
            ← 뉴스 목록으로
          </button>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="h-full overflow-y-auto bg-white">
        {/* 신문사 헤더 */}
        <div className="border-b border-gray-200 bg-white py-4 px-6 flex items-center justify-between">
          <div className="flex items-center gap-2 text-emerald-700">
            <TrendingUp size={18} />
            <span className="font-bold text-lg text-gray-900">MincoTimes</span>
          </div>
          <span className="text-gray-400 text-xs">가상 경제 전문 미디어 · 무단 전재 금지</span>
        </div>

        {/* 기사 본문 */}
        <div className="max-w-2xl mx-auto px-6 py-10 flex flex-col gap-6">
          {/* 제목 */}
          <div className="flex flex-col gap-3">
            <h1 className="text-2xl font-bold text-gray-900 leading-snug">
              {article.headline}
            </h1>
            <p className="text-gray-500 text-base leading-snug">
              {article.subheadline}
            </p>
          </div>

          {/* 메타 */}
          <div className="flex items-center gap-2 text-gray-400 text-sm pb-6 border-b border-gray-200">
            <span>{article.author}</span>
            <span>·</span>
            <span>{article.publishedAt}</span>
          </div>

          {/* 본문 */}
          <div className="flex flex-col gap-5">
            {article.body.split(/\n\n+/).map((para, i) => (
              <p key={i} className="text-gray-700 text-sm leading-8 whitespace-pre-line">
                {para.trim()}
              </p>
            ))}
          </div>

          {/* 뒤로 */}
          <div className="pt-6 border-t border-gray-200 flex justify-end">
            <button
              onClick={() => navigate('/news')}
              className="text-gray-400 hover:text-gray-700 text-sm transition-colors"
            >
              ← 뉴스 목록으로 돌아가기
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
