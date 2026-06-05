import type { NewsArticle } from '../types'

const NOISE_RANGE = 10

function uniformNoise(range: number): number {
  return (Math.random() * 2 - 1) * range
}

export interface PriceChangeResult {
  changes: Record<string, number>
  flipped: boolean
  flippedArticleId: string | null  // 반전된 기사 ID (없으면 null)
}

export function computePriceChanges(news: NewsArticle[]): PriceChangeResult {
  const base: Record<string, number> = {}

  let flipped           = false
  let flippedArticleId: string | null = null

  for (const article of news) {
    // 아직 반전이 발생하지 않은 경우에만 주사위를 굴림
    const dice     = flipped ? 0 : Math.ceil(Math.random() * 6)
    const doFlip   = !flipped && dice === 1

    for (const [symbol, pct] of Object.entries(article.priceImpact)) {
      base[symbol] = (base[symbol] ?? 0) + (doFlip ? -pct : pct)
    }

    if (doFlip) {
      flipped          = true
      flippedArticleId = article.id
      // 첫 번째 반전 발생 → 이후 기사는 주사위 없이 정상 합산
    }
  }

  // noise 적용
  const changes: Record<string, number> = {}
  for (const [symbol, impact] of Object.entries(base)) {
    changes[symbol] = impact + uniformNoise(NOISE_RANGE)
  }

  return { changes, flipped, flippedArticleId }
}
