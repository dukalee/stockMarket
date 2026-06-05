import OpenAI from 'openai'
import type { NewsArticle, CounterArticle, Stock } from '../types'

const SECTORS: Record<string, string[]> = {
  '기술': ['SSEI', 'MRCE', 'CHOC', 'SKYH', 'GLES'],
  '교육': ['MINC', 'DKCD', 'SGCP', 'CRZU'],
  '금융': ['DRBN', 'SSSN', 'NNBK', 'GKMN'],
  '물류': ['CPNG', 'NVRL', 'CHMK'],
  '게임': ['NEXT', 'MKSF', 'OBSD', 'GRUP'],
}

const QUARTER_DATE_RANGE: Record<number, string> = {
  1: '1월 1일 ~ 3월 31일',
  2: '4월 1일 ~ 6월 30일',
  3: '7월 1일 ~ 9월 30일',
  4: '10월 1일 ~ 12월 31일',
}

// Phase 1: game event planner — decides metadata only, no article text
const PLANNER_SYSTEM_PROMPT = `당신은 가상 주식 시뮬레이션 게임의 이벤트 설계자입니다. 출력은 반드시 JSON만 반환합니다.

주어진 종목 목록과 섹터 구성을 바탕으로 이번 분기 뉴스 이벤트 8개를 설계합니다.
기사 본문은 작성하지 않습니다. 각 이벤트의 메타데이터만 반환합니다.`

// Phase 2: journalist writer — one article per call
const WRITER_SYSTEM_PROMPT = `당신은 세계적인 경제 전문 언론사의 기자입니다.

주어진 사건과 [기사 스타일] 지시에 따라 실제 금융 뉴스 기사처럼 작성하세요.

=== 공통 금지 사항 (모든 스타일 적용) ===

"주가가 오를", "주가가 내릴", "상승 전망", "하락 전망" 등 주가 방향 예측 표현 금지
주가·시가총액·수익률 등 시장 결과 수치 금지
투자 매수·매도를 유도하는 문장 일체 금지

=== 수치·통계 필수 포함 (모든 스타일 적용) ===

기사마다 아래 유형의 수치를 3개 이상 반드시 포함하세요:
- 매출·영업이익·순이익 변화율 (예: "전년 동기 대비 매출 17.3% 감소")
- 시장 규모·점유율 (예: "국내 시장 규모 4.2조원", "점유율 23%→19%")
- 계약 금액·투자 규모 (예: "총 계약 규모 8,500억원")
- 거시 지표 (예: "기준금리 0.25%p 인상", "재고 지수 전월 대비 +12%")
수치는 구체적이고 그럴듯한 허구의 숫자를 사용하세요. 실제 공시 데이터가 아닌 게임용 픽션입니다.
수치의 크기가 기사의 무게감을 전달해야 합니다.

분량: 600~1200자, 단락은 \\n\\n으로 구분`

function buildPlannerPrompt(year: number, quarter: number, stocks: Stock[]): string {
  const realYear  = 2025 + year
  const dateRange = QUARTER_DATE_RANGE[quarter]

  const stockList = stocks.map(s => `- ${s.id} | ${s.name} | ${s.sector}`).join('\n')
  const sectorMap = Object.entries(SECTORS)
    .map(([sec, ids]) => `  ${sec}: ${ids.join(', ')}`)
    .join('\n')

  return `현재 분기: YEAR ${year} Q${quarter}
발행 날짜 범위: ${realYear}년 ${dateRange}

종목 목록:
${stockList}

섹터 구성:
${sectorMap}

=== 설계 규칙 ===

정확히 8개 이벤트를 설계한다. 각 이벤트마다:

A. targetType 선택 (global 50% / local 50% 비율 유지)
   - global: 섹터 1개 전체에 영향
   - local: 종목 1개에만 영향 (같은 분기 내 동일 종목 중복 금지)

B. 이벤트 타입: earnings / contract / rumor / correction / policy / macro / accident 중 선택

C. 강도 배정 — 8개 기사의 강도는 아래 구성을 반드시 지킨다:
   - 기사 1: 약간 부정  → priceImpact  -5 ~ +5%   (sentiment: bearish, strength: slight)
   - 기사 2: 부정       → priceImpact  -5 ~ -10%  (sentiment: bearish, strength: moderate)
   - 기사 3: 매우 부정  → priceImpact -15 ~ -25%  (sentiment: bearish, strength: strong)
   - 기사 4: 약간 긍정  → priceImpact  -5 ~ +5%   (sentiment: bullish, strength: slight)
   - 기사 5: 긍정       → priceImpact  +5 ~ +10%  (sentiment: bullish, strength: moderate)
   - 기사 6: 매우 긍정  → priceImpact +15 ~ +25%  (sentiment: bullish, strength: strong)
   - 기사 7: 랜덤 (1~6 중 자유 선택, strength는 해당 강도에 맞게 배정)
   - 기사 8: 랜덤 (1~6 중 자유 선택, strength는 해당 강도에 맞게 배정)
   순서는 랜덤하게 섞어도 되지만 위 6가지 강도는 반드시 1개씩 포함되어야 한다.

I. isSurprise — 8개 기사 중 정확히 2개를 surprise 기사로 지정한다 (isSurprise: true).
   - surprise 기사는 헤드라인이 실제 priceImpact 방향과 반대 방향을 암시한다
   - 본문을 끝까지 읽으면 진짜 방향이 드러나는 구조
   - moderate 또는 strong 강도 기사를 대상으로 권장 (slight는 이미 모호하므로 제외 권장)
   - 나머지 6개 기사는 isSurprise: false

J. isInverted — isSurprise가 아닌 6개 기사 중 정확히 1개를 inverted 기사로 지정한다 (isInverted: true).
   - 기사 본문·헤드라인은 sentiment 방향대로 정상 작성된다 (독자는 방향을 자연스럽게 읽음)
   - 단, 실제 priceImpact는 반대 방향의 미미한 수치로 설정한다:
     · bearish 기사 → priceImpact +1 ~ +5% (약간 긍정 효과)
     · bullish 기사 → priceImpact -1 ~ -5% (약간 부정 효과)
   - strength는 기존 배정 그대로 유지 (스타일 가이드는 apparent sentiment 기준)
   - 나머지 5개 기사는 isInverted: false
   - isSurprise: true인 기사에는 isInverted: false만 허용 (중복 지정 금지)

D. companyName: 기사에서 다룰 허구의 한국 기업명 (실제 기업명 사용 금지)
   - local 기사: 해당 종목의 게임 내 이름 그대로 사용 가능 (예: SSEI → "사성전자")
   - global 기사: 해당 섹터 대표 기관·기업의 허구 이름

E. industry: 해당 섹터의 구체적 산업군 (예: "반도체·전자부품", "핀테크·디지털금융")

F. event: 이번 분기에 발생한 구체적 사건 (1~2문장, 한국어)
   - 방향성 단어 금지: "호재", "악재", "상승", "하락", "기대", "우려"
   - 구체적 사건 팩트만 서술 (공시·계약·사고·정책 발표 등)

G. sentiment: 기사의 긍정·부정 비중 조절 기준
   - bullish / bearish / neutral

H. priceImpact: 주사위 범위 내 소수점 1자리 실수값
   - global: 해당 섹터 전체 종목에 동방향·유사한 크기 부여
   - local: 해당 종목 1개에만 부여

[출력 JSON]
{
  "articles": [
    {
      "targetType": "global 또는 local",
      "targetSector": "기술 또는 교육 또는 금융 또는 물류 또는 게임",
      "targetSymbol": "종목ID (local일 때만, 아니면 생략)",
      "eventType": "earnings | contract | rumor | correction | policy | macro | accident",
      "companyName": "허구 한국 기업명",
      "industry": "산업군",
      "event": "구체적 사건 설명 (1~2문장)",
      "sentiment": "bullish | bearish | neutral",
      "strength": "slight | moderate | strong",
      "isSurprise": true or false,
      "isInverted": true or false,
      "affectedSymbols": ["종목ID"],
      "priceImpact": { "종목ID": 수치 }
    }
  ]
}`
}

const KOREAN_REPORTER_NAMES = [
  '김지수', '이민준', '박서연', '최유진', '정민서',
  '한소희', '오준혁', '윤채원', '임성현', '강다은',
  '신동우', '류하은', '문준영', '백지원', '조현우',
]

function buildWriterPrompt(
  companyName: string,
  industry: string,
  event: string,
  sentiment: string,
  strength: string,
  isSurprise: boolean,
  year: number,
  quarter: number,
  reporterIndex: number,
): string {
  const realYear     = 2025 + year
  const dateRange    = QUARTER_DATE_RANGE[quarter]
  const sentimentKor = sentiment === 'bullish' ? '긍정' : sentiment === 'bearish' ? '부정' : '중립'
  const reporter     = KOREAN_REPORTER_NAMES[reporterIndex % KOREAN_REPORTER_NAMES.length]
  const opposite     = sentimentKor === '긍정' ? '부정' : '긍정'

  const styleGuide = isSurprise
    ? `[기사 스타일: 반전 서프라이즈 ⚡]
이 기사의 실제 의미는 ${sentimentKor}이지만, 헤드라인과 도입부는 ${opposite} 방향을 강하게 암시합니다.
독자가 헤드라인만 읽으면 ${opposite} 뉴스로 오해하고, 끝까지 읽으면 "아, 사실은 ${sentimentKor}이었구나"를 깨닫는 구조입니다.

구조:
- 헤드라인: ${opposite} 방향을 암시하는 사건 팩트 (위기감·부정적 수치 등)
- 부제목: 두 해석이 충돌하는 모호한 표현
- 본문 도입 (첫 25~30%): ${opposite} 방향의 표면적 사실과 수치. 독자는 ${opposite} 기사라고 확신.
- 본문 중반 전환 (한 단락): "다만", "그러나", "주목할 점은", "역설적으로"로 시작하는 반전 단락
- 본문 후반 (나머지 50~60%): ${sentimentKor} 방향의 실질적 의미와 수치. 자세히 읽은 독자만 진짜 의미 파악.
- 결론: ${sentimentKor} 방향으로 마무리하되, 불확실성 표현 포함`
    : strength === 'strong'
    ? `[기사 스타일: 단방향 명확]
이 기사는 ${sentimentKor} 정보만 담습니다.
반대 의견이나 모호한 표현 없이 ${sentimentKor}적 사실과 수치를 직접적으로 서술하세요.
전문가 의견도 모두 ${sentimentKor} 방향이어야 합니다.
결론을 명확히 제시하며 마무리하세요.`
    : strength === 'moderate'
    ? `[기사 스타일: 반전 후 수렴]
기사 앞부분(처음 30~40%)은 ${opposite}적 배경과 우려로 시작하세요.
중반부에서 반전 포인트를 두고, 후반부(60% 이후)는 ${sentimentKor} 방향으로 수렴하며 마무리하세요.
독자가 읽다 보면 결국 ${sentimentKor}쪽이 우세하다고 느껴야 합니다.`
    : `[기사 스타일: 최대 모호]
긍정 요소와 부정 요소를 50:50으로 배분하세요.
어떤 문장도 단독으로 방향성을 암시하면 안 됩니다.
결론 없이 "향후 지켜봐야 한다", "시장의 반응은 엇갈린다"로 끝내세요.
독자가 기사를 읽은 후에도 방향을 확신할 수 없어야 합니다.`

  return `[입력]

기업명: ${companyName}
산업군: ${industry}
사건: ${event}

${styleGuide}

다음 JSON 형식으로 반환하세요:
{
  "headline": "기사 제목 (사건 팩트 중심, 주가 방향 예측 금지)",
  "subheadline": "부제목",
  "body": "기사 본문 (600~1200자, \\n\\n으로 단락 구분)",
  "summary": "핵심 내용 1~2줄 요약",
  "author": "${reporter} 기자",
  "publishedAt": "${realYear}년 ${dateRange} 사이의 날짜 (YYYY.MM.DD  HH:MM 형식, 다른 기사와 다른 날짜 사용)"
}`
}

interface ArticlePlan {
  targetType:      'global' | 'local'
  targetSector?:   string
  targetSymbol?:   string
  eventType?:      string
  companyName:     string
  industry:        string
  event:           string
  sentiment:       'bullish' | 'bearish' | 'neutral'
  strength:        'slight' | 'moderate' | 'strong'
  isSurprise:      boolean
  isInverted:      boolean
  affectedSymbols: string[]
  priceImpact:     Record<string, number>
}

interface WrittenArticle {
  headline:    string
  subheadline: string
  body:        string
  summary:     string
  author:      string
  publishedAt: string
}

async function planArticles(
  client: OpenAI,
  year: number,
  quarter: number,
  stocks: Stock[],
): Promise<ArticlePlan[]> {
  const response = await client.chat.completions.create({
    model: 'gpt-4.1-mini',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: PLANNER_SYSTEM_PROMPT },
      { role: 'user',   content: buildPlannerPrompt(year, quarter, stocks) },
    ],
    temperature: 1.0,
    max_tokens: 4096,
  })
  const raw = JSON.parse(response.choices[0].message.content ?? '{}')
  return Array.isArray(raw) ? raw : (raw.articles ?? [])
}

async function writeArticle(
  client: OpenAI,
  plan: ArticlePlan,
  year: number,
  quarter: number,
  reporterIndex: number,
): Promise<WrittenArticle> {
  const response = await client.chat.completions.create({
    model: 'gpt-4.1-mini',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: WRITER_SYSTEM_PROMPT },
      { role: 'user',   content: buildWriterPrompt(plan.companyName, plan.industry, plan.event, plan.sentiment, plan.strength ?? 'slight', plan.isSurprise ?? false, year, quarter, reporterIndex) },
    ],
    temperature: 1.0,
    max_tokens: 2048,
  })
  const raw = JSON.parse(response.choices[0].message.content ?? '{}')
  return {
    headline:    raw.headline    ?? '제목 없음',
    subheadline: raw.subheadline ?? '',
    body:        raw.body        ?? '',
    summary:     raw.summary     ?? '',
    author:      raw.author      ?? '편집부',
    publishedAt: raw.publishedAt ?? '',
  }
}

const NEWS_TARGET = 8

export async function generateQuarterNews(
  apiKey: string,
  year: number,
  quarter: number,
  stocks: Stock[],
  onProgress?: (articlesCompleted: number) => void,
): Promise<NewsArticle[]> {
  const client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true })

  // Phase 1: plan article metadata (game mechanics)
  let plans = await planArticles(client, year, quarter, stocks)
  if (plans.length < NEWS_TARGET) {
    plans = await planArticles(client, year, quarter, stocks)
  }

  // Phase 2: write all articles in parallel — progress fires as each completes
  let completedCount = 0
  const articles = await Promise.all(
    plans.map(async (plan, i) => {
      let written: WrittenArticle
      try {
        written = await writeArticle(client, plan, year, quarter, i)
      } catch {
        written = { headline: '제목 없음', subheadline: '', body: '', summary: '', author: '편집부', publishedAt: '' }
      }
      onProgress?.(++completedCount)
      return {
        id:              `Y${year}Q${quarter}-${i}`,
        quarter:         `YEAR${year}-Q${quarter}`,
        headline:        written.headline,
        subheadline:     written.subheadline,
        body:            written.body,
        summary:         written.summary,
        author:          written.author,
        publishedAt:     written.publishedAt,
        affectedSymbols: plan.affectedSymbols ?? [],
        sentiment:       plan.sentiment       ?? 'neutral',
        strength:        plan.strength        ?? 'slight',
        isSurprise:      plan.isSurprise      ?? false,
        isInverted:      plan.isInverted      ?? false,
        priceImpact:     plan.priceImpact     ?? {},
        targetType:      (plan.targetType === 'global' ? 'global' : 'local') as 'global' | 'local',
        targetSector:    plan.targetSector,
      }
    })
  )

  return articles
}

export async function generateCounterArticle(
  apiKey: string,
  originalArticle: NewsArticle,
): Promise<CounterArticle | null> {
  const client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true })

  const prompt = `[입력]

기업명: (원본 기사 관련 기업)
산업군: (원본 기사 관련 산업)
사건: 아래 원본 기사가 보도된 이후 상황이 정반대로 전개되었습니다. 이를 반박하는 긴급 속보를 작성하세요.

원본 기사 제목: ${originalArticle.headline}
원본 기사 내용: ${originalArticle.body}

기사 성향: 중립 (원본과 상반된 시각을 균형 있게 제시)

추가 조건:
- "당초 알려진 것과 달리", "기존 보도와 상반되게" 등 반전을 명시하는 표현 사용
- 인용문 최소 1개, 수치 데이터 최소 1개 포함
- 실제 기업명·인물명·언론사 사용 금지

다음 JSON 형식으로 반환하세요:
{
  "headline": "기사 제목",
  "subheadline": "부제목 (두 시각 병치)",
  "body": "본문 (600자 이상, \\n\\n으로 단락 구분)",
  "author": "홍길동 기자",
  "publishedAt": "날짜"
}`

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4.1-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: WRITER_SYSTEM_PROMPT },
        { role: 'user',   content: prompt },
      ],
      temperature: 1.0,
    })

    const raw = JSON.parse(response.choices[0].message.content ?? '{}')
    return {
      headline:         raw.headline         ?? '긴급 속보',
      subheadline:      raw.subheadline      ?? '',
      body:             raw.body             ?? '',
      author:           raw.author           ?? '편집부',
      publishedAt:      raw.publishedAt      ?? '',
      originalHeadline: originalArticle.headline,
    }
  } catch {
    return null
  }
}
