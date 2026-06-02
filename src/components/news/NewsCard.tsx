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
      className="bg-gray-900 border border-gray-800 hover:border-gray-600 rounded-xl p-5 text-left flex flex-col gap-3 transition-colors group"
    >
      <div className="flex items-center gap-2 text-gray-500 text-xs">
        <Newspaper size={13} />
        <span>{article.publishedAt}</span>
        <span>|</span>
        <span>{article.author}</span>
      </div>

      <div className="flex flex-col gap-1.5">
        <h2 className="text-gray-100 font-semibold text-sm leading-snug group-hover:text-white transition-colors">
          {article.headline}
        </h2>
        <p className="text-gray-400 text-xs leading-relaxed line-clamp-2">
          {article.subheadline}
        </p>
      </div>

      <div className="flex justify-end mt-auto">
        <span className="text-emerald-400 text-xs group-hover:text-emerald-300 transition-colors">
          기사 읽기 →
        </span>
      </div>
    </button>
  )
}
