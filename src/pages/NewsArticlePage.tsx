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
          <p className="text-mute text-sm">기사를 찾을 수 없습니다.</p>
          <button
            onClick={() => navigate('/news')}
            className="min-h-10 px-4 border border-ink bg-transparent text-ink text-sm font-bold hover:bg-paper-deep"
          >
            ← 뉴스 목록으로
          </button>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="h-full overflow-y-auto bg-paper">
        {/* 신문사 헤더 */}
        <div className="border-b-4 border-double border-ink bg-paper py-4 px-6 flex items-center justify-between">
          <div className="flex items-center gap-2 text-ink">
            <TrendingUp size={18} />
            <span className="font-serif font-black text-lg text-ink">AI Times</span>
          </div>
          <span className="text-mute text-xs">가상 경제 전문 미디어 · 무단 전재 금지</span>
        </div>

        {/* 기사 본문 */}
        <div className="max-w-2xl mx-auto px-6 py-10 flex flex-col gap-6">
          {/* 제목 */}
          <div className="flex flex-col gap-3">
            <h1 className="font-serif text-2xl font-black text-ink leading-snug">
              {article.headline}
            </h1>
            <p className="text-ink-soft text-base leading-snug">
              {article.subheadline}
            </p>
          </div>

          {/* 메타 */}
          <div className="flex items-center gap-2 text-mute text-sm pb-6 border-b-2 border-ink">
            <span>{article.author}</span>
            <span>·</span>
            <span>{article.publishedAt}</span>
          </div>

          {/* 본문 */}
          <div className="flex flex-col gap-5">
            {article.body.split(/\n\n+/).map((para, i) => (
              <p key={i} className="text-ink-soft text-sm leading-8 whitespace-pre-line">
                {para.trim()}
              </p>
            ))}
          </div>

          {/* 뒤로 */}
          <div className="pt-6 border-t border-rule flex justify-end">
            <button
              onClick={() => navigate('/news')}
              className="min-h-10 px-4 border border-ink bg-transparent text-ink text-sm font-bold hover:bg-paper-deep"
            >
              ← 뉴스 목록으로 돌아가기
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
