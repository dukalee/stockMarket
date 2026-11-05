import type { NewsArticle, Stock } from '../types'
import { NEWS_POOL, type PoolArticle, type PoolSentiment, type PoolStrength } from '../data/newsPool'
import { createRng, randomRng, type Rng } from '../utils/seededRandom'

/**
 * 미리 작성된 뉴스 풀에서 분기 뉴스 8개를 구성한다. (API 키·서버 불필요)
 *
 * 분기 구성 규칙:
 *  - 6가지 강도(약간/보통/매우 × 부정/긍정) 1개씩 + 랜덤 2개 = 8개
 *  - 그중 moderate/strong 2개는 반전 서프라이즈(isSurprise) 기사
 *  - 서프라이즈가 아닌 기사 1개는 isInverted — 본문 방향과 반대로 미미한 영향
 *  - global 4 / local 4 비율 유지, 같은 분기 내 동일 종목 local 중복 금지
 *
 * seed 를 주면(대회 모드) 모든 선택이 시드로 결정돼서, 같은 시드의 참가자는 항상 같은 기사를 받는다.
 * 이전 분기에 나온 기사를 제외하는 규칙도 이전 분기를 같은 시드로 다시 계산해서 맞춘다.
 */

const NEWS_TARGET = 8

const QUARTER_MONTHS: Record<number, [number, number, number]> = {
  1: [1, 2, 3],
  2: [4, 5, 6],
  3: [7, 8, 9],
  4: [10, 11, 12],
}

const KOREAN_REPORTER_NAMES = [
  '김지수', '이민준', '박서연', '최유진', '정민서',
  '한소희', '오준혁', '윤채원', '임성현', '강다은',
  '신동우', '류하은', '문준영', '백지원', '조현우',
]

const BASE_CATEGORIES: { sentiment: PoolSentiment; strength: PoolStrength }[] = [
  { sentiment: 'bearish', strength: 'slight' },
  { sentiment: 'bearish', strength: 'moderate' },
  { sentiment: 'bearish', strength: 'strong' },
  { sentiment: 'bullish', strength: 'slight' },
  { sentiment: 'bullish', strength: 'moderate' },
  { sentiment: 'bullish', strength: 'strong' },
]

// 강도별 priceImpact 범위 [min, max]
const IMPACT_RANGE: Record<PoolSentiment, Record<PoolStrength, [number, number]>> = {
  bearish: { slight: [-25, -10], moderate: [-50, -25], strong: [-90, -50] },
  bullish: { slight: [10, 25],   moderate: [25, 50],   strong: [50, 90] },
}

// 시뮬레이션 모드에서 이미 사용한 풀 기사 id (같은 세션 내 반복 최소화)
const usedPoolIds = new Set<string>()

const round1 = (n: number) => Math.round(n * 10) / 10
const sleep = (ms: number) => new Promise<void>(res => setTimeout(res, ms))

function pad(n: number) { return String(n).padStart(2, '0') }

/** 게임 전체 기준 분기 번호(1부터) → 연도·분기 */
export const yearOf    = (qIndex: number) => Math.floor((qIndex - 1) / 4) + 1
export const quarterOf = (qIndex: number) => ((qIndex - 1) % 4) + 1

interface Slot {
  sentiment: PoolSentiment
  strength: PoolStrength
  surprise: boolean
  inverted: boolean
  scope: 'global' | 'local'
}

function buildSlots(rng: Rng): Slot[] {
  const extra = [0, 1].map(() => rng.pick(BASE_CATEGORIES))
  const cats = rng.shuffle([...BASE_CATEGORIES, ...extra])

  const eligible = cats
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => c.strength !== 'slight')
  const surpriseIdx = new Set(rng.shuffle(eligible).slice(0, 2).map(x => x.i))

  const rest = cats.map((_, i) => i).filter(i => !surpriseIdx.has(i))
  const invertedIdx = rng.pick(rest)

  const scopes = rng.shuffle<'global' | 'local'>(['global', 'global', 'global', 'global', 'local', 'local', 'local', 'local'])

  return cats.map((c, i) => ({
    ...c,
    surprise: surpriseIdx.has(i),
    inverted: i === invertedIdx,
    scope: scopes[i],
  }))
}

function pickPoolArticle(
  slot: Slot,
  sectorFull: (sector: string) => boolean,
  used: Set<string>,
  rng: Rng,
): PoolArticle | null {
  // local 기사는 대상 종목이 남아 있는 섹터에서만 고른다 (같은 분기에 같은 종목 중복 방지)
  const matches = (a: PoolArticle) =>
    a.sentiment === slot.sentiment &&
    a.strength === slot.strength &&
    a.surprise === slot.surprise &&
    !(a.scope === 'local' && sectorFull(a.sector))

  const all = NEWS_POOL.filter(matches)
  if (all.length === 0) return null

  // 우선순위: 미사용 + 원하는 scope → 미사용 → (재사용 허용) 원하는 scope → 전체
  const fresh = all.filter(a => !used.has(a.id))
  const candidates =
    fresh.filter(a => a.scope === slot.scope).length > 0 ? fresh.filter(a => a.scope === slot.scope) :
    fresh.length > 0                                      ? fresh :
    all.filter(a => a.scope === slot.scope).length > 0    ? all.filter(a => a.scope === slot.scope) :
    all

  return rng.pick(candidates)
}

function makeDate(rng: Rng, year: number, quarter: number, usedDays: Set<string>): string {
  const realYear = 2025 + year
  const months = QUARTER_MONTHS[quarter]
  for (let attempt = 0; attempt < 30; attempt++) {
    const month = months[rng.int(3)]
    const day = 1 + rng.int(28)
    const key = `${month}-${day}`
    if (usedDays.has(key) && attempt < 29) continue
    usedDays.add(key)
    const hour = 7 + rng.int(14)
    const min = rng.int(60)
    return `${realYear}.${pad(month)}.${pad(day)}  ${pad(hour)}:${pad(min)}`
  }
  return `${realYear}.${pad(months[0])}.01  09:00`
}

/** 한 분기 분량의 기사 8개를 만든다. 같은 rng·used 상태면 항상 같은 결과. */
function buildQuarterArticles(
  rng: Rng,
  year: number,
  quarter: number,
  stocks: Stock[],
  used: Set<string>,
): NewsArticle[] {
  const slots = buildSlots(rng)
  const usedLocalSymbols = new Set<string>()
  const usedDays = new Set<string>()
  const articles: NewsArticle[] = []

  for (let i = 0; i < NEWS_TARGET; i++) {
    const slot = slots[i]
    const pool = pickPoolArticle(slot, sector =>
      stocks.filter(st => st.sector === sector).every(st => usedLocalSymbols.has(st.id)),
      used, rng,
    )
    if (!pool) throw new Error('뉴스 풀에서 조건에 맞는 기사를 찾을 수 없습니다.')
    used.add(pool.id)

    const sectorStocks = stocks.filter(s => s.sector === pool.sector)
    let target: Stock | undefined
    if (pool.scope === 'local') {
      const free = sectorStocks.filter(s => !usedLocalSymbols.has(s.id))
      const list = free.length > 0 ? free : sectorStocks
      target = list.length > 0 ? rng.pick(list) : undefined
      if (target) usedLocalSymbols.add(target.id)
    }
    if (pool.scope === 'local' && !target) throw new Error('기사 대상 종목을 찾을 수 없습니다.')

    // priceImpact 계산
    let base: number
    if (slot.inverted) {
      // 본문 방향과 반대의 미미한 영향 (1 ~ 5%)
      const mag = rng.range(1, 5)
      base = pool.sentiment === 'bearish' ? mag : -mag
    } else {
      const [lo, hi] = IMPACT_RANGE[pool.sentiment][pool.strength]
      base = rng.range(lo, hi)
    }

    const priceImpact: Record<string, number> = {}
    let affectedSymbols: string[]
    if (pool.scope === 'local' && target) {
      priceImpact[target.id] = round1(base)
      affectedSymbols = [target.id]
    } else {
      affectedSymbols = sectorStocks.map(s => s.id)
      for (const s of sectorStocks) {
        priceImpact[s.id] = round1(base + rng.range(-1, 1))
      }
    }

    const company = target?.name ?? ''
    const fill = (text: string) => text.split('{회사}').join(company)

    articles.push({
      id:              `Y${year}Q${quarter}-${i}`,
      quarter:         `YEAR${year}-Q${quarter}`,
      headline:        fill(pool.headline),
      subheadline:     fill(pool.subheadline),
      body:            pool.paragraphs.map(fill).join('\n\n'),
      summary:         fill(pool.summary),
      author:          `${KOREAN_REPORTER_NAMES[i % KOREAN_REPORTER_NAMES.length]} 기자`,
      publishedAt:     makeDate(rng, year, quarter, usedDays),
      affectedSymbols,
      sentiment:       pool.sentiment,
      strength:        pool.strength,
      isSurprise:      slot.surprise,
      isInverted:      slot.inverted,
      priceImpact,
      targetType:      pool.scope,
      targetSector:    pool.scope === 'global' ? pool.sector : undefined,
    })
  }

  return articles
}

/**
 * 해당 분기의 뉴스를 만든다.
 * @param seed 대회 시드. 없으면 시뮬레이션 모드(매번 무작위).
 */
export async function generateQuarterNews(
  year: number,
  quarter: number,
  stocks: Stock[],
  onProgress?: (articlesCompleted: number) => void,
  seed?: string,
): Promise<NewsArticle[]> {
  let articles: NewsArticle[]

  if (seed) {
    // 이전 분기들을 같은 시드로 다시 계산해서 "이미 나온 기사" 상태를 재현한다
    const qIndex = (year - 1) * 4 + quarter
    const used = new Set<string>()
    for (let k = 1; k < qIndex; k++) {
      buildQuarterArticles(createRng(`${seed}:news:${k}`), yearOf(k), quarterOf(k), stocks, used)
    }
    articles = buildQuarterArticles(createRng(`${seed}:news:${qIndex}`), year, quarter, stocks, used)
  } else {
    articles = buildQuarterArticles(randomRng, year, quarter, stocks, usedPoolIds)
  }

  // 로딩 바가 8칸 채워지는 것을 자연스럽게 보여준다
  for (let i = 1; i <= articles.length; i++) {
    onProgress?.(i)
    await sleep(90)
  }
  return articles
}
