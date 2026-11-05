import type { Sector } from '../../types'

export type PoolStrength = 'slight' | 'moderate' | 'strong'
export type PoolSentiment = 'bullish' | 'bearish'

/**
 * 미리 작성된 뉴스 기사 풀의 기사 한 편.
 * - local 기사: 본문의 `{회사}` 가 같은 섹터의 종목명으로 치환된다.
 * - surprise 기사: 헤드라인·도입부는 반대 방향을 암시하고, 끝까지 읽어야 실제 방향(sentiment)이 드러난다.
 * - sentiment / strength 는 "실제 방향 / 강도" 기준이다.
 */
export interface PoolArticle {
  id: string
  sector: Sector
  scope: 'global' | 'local'
  sentiment: PoolSentiment
  strength: PoolStrength
  surprise: boolean
  headline: string
  subheadline: string
  summary: string
  paragraphs: string[]
}

let seq = 0

/** 기사 한 편을 만든다. id 는 호출 순서대로 자동 부여된다. */
export function e(
  sector: Sector,
  scope: 'global' | 'local',
  sentiment: PoolSentiment,
  strength: PoolStrength,
  headline: string,
  subheadline: string,
  summary: string,
  paragraphs: string[],
  surprise = false,
): PoolArticle {
  return {
    id: `P${String(++seq).padStart(3, '0')}`,
    sector, scope, sentiment, strength, surprise,
    headline, subheadline, summary, paragraphs,
  }
}
