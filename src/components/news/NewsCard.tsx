import { Newspaper } from 'lucide-react'
import type { NewsArticle } from '../../types'

interface Props {
  article: NewsArticle
  onClick: () => void
}

export default function NewsCard({ article, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className="bg-paper-card border border-ink hover:bg-paper-deep p-5 text-left flex flex-col gap-3 transition-colors group"
    >
      <div className="flex items-center gap-2 text-mute text-xs">
        <Newspaper size={13} />
        <span>{article.publishedAt}</span>
        <span>|</span>
        <span>{article.author}</span>
      </div>

      <div className="flex flex-col gap-1.5">
        <h2 className="font-serif text-ink font-black text-sm leading-snug group-hover:underline">
          {article.headline}
        </h2>
        <p className="text-ink-soft text-xs leading-relaxed line-clamp-2">
          {article.subheadline}
        </p>
      </div>

      <div className="flex justify-end mt-auto">
        <span className="text-ink text-xs font-bold">
          기사 읽기 →
        </span>
      </div>
    </button>
  )
}
