/**
 * 미리 작성된 뉴스 기사 풀 (API 키 / 서버 없이 동작).
 * 기사 원문은 분량별로 나눠 `newsPool/part*.ts` 에 있다.
 *  - partA: 약간 긍정/부정 (slight)         — 최대 모호
 *  - partB: 긍정/부정 (moderate)            — 반전 후 수렴
 *  - partC: 매우 긍정/부정 (strong)         — 단방향 명확
 *  - partD: 반전 서프라이즈, 실제 방향 = 긍정
 *  - partE: 반전 서프라이즈, 실제 방향 = 부정
 */
import type { PoolArticle } from './newsPool/base'
import { PART_A } from './newsPool/partA'
import { PART_B } from './newsPool/partB'
import { PART_C } from './newsPool/partC'
import { PART_D } from './newsPool/partD'
import { PART_E } from './newsPool/partE'

export type { PoolArticle, PoolSentiment, PoolStrength } from './newsPool/base'

export const NEWS_POOL: PoolArticle[] = [
  ...PART_A,
  ...PART_B,
  ...PART_C,
  ...PART_D,
  ...PART_E,
]
