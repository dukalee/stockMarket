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

주어진 사건을 기반으로 실제 금융 뉴스 기사처럼 작성하세요.

중요한 규칙:

기사 작성 시점에서는 미래 결과를 알 수 없습니다.
주가 상승률, 하락률, 시가총액 변화 등 시장 결과를 직접 작성하지 마세요.
투자자 반응을 묘사할 수는 있지만 수치화하지 마세요.
"주가가 상승했다", "주가가 하락했다"와 같은 표현을 사용하지 마세요.
기사만 읽고 방향성을 100% 확신할 수 없도록 작성하세요.
긍정 요소와 부정 요소를 반드시 함께 포함하세요.
기사 전체의 30~40%는 산업 및 거시경제 배경 설명으로 채우세요.
기사 전체의 20~30%는 전문가 인터뷰나 업계 관계자 의견으로 채우세요.
상반된 전문가 의견을 최소 2개 이상 포함하세요.
투자 조언처럼 보이는 문장은 금지합니다.
기사 제목만 보고 방향성이 드러나지 않도록 작성하세요.
기사 내용은 600~1200자 분량으로 작성하세요.
루머, 추정, 관측은 반드시 불확실성을 표현하세요.
기사 말미에 향후 확인해야 할 변수들을 정리하세요.
기사 자체가 특정 종목을 매수 또는 매도하도록 유도해서는 안 됩니다.

주의:
기사 성향은 기사 내부에서 직접 표현하지 말고, 긍정 요소와 부정 요소의 비중 조절을 통해 간접적으로만 반영하세요.`

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

C. 주사위 굴리기 (1~6):
   1: 약간 부정 → priceImpact  0 ~ -5%
   2: 약간 긍정 → priceImpact  0 ~ +5%
   3: 부정      → priceImpact -5 ~ -10%
   4: 긍정      → priceImpact +5 ~ +10%
   5: 매우 부정 → priceImpact -10 ~ -20%
   6: 매우 긍정 → priceImpact +10 ~ +20%

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
  year: number,
  quarter: number,
  reporterIndex: number,
): string {
  const realYear     = 2025 + year
  const dateRange    = QUARTER_DATE_RANGE[quarter]
  const sentimentKor = sentiment === 'bullish' ? '긍정' : sentiment === 'bearish' ? '부정' : '중립'
  const reporter     = KOREAN_REPORTER_NAMES[reporterIndex % KOREAN_REPORTER_NAMES.length]

  return `[입력]

기업명: ${companyName}
산업군: ${industry}
사건: ${event}
기사 성향: ${sentimentKor}

다음 JSON 형식으로 반환하세요:
{
  "headline": "기사 제목 (방향성 없는 사건 팩트)",
  "subheadline": "부제목 (상반된 해석 두 가지 병치)",
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
      { role: 'user',   content: buildWriterPrompt(plan.companyName, plan.industry, plan.event, plan.sentiment, year, quarter, reporterIndex) },
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

  // Phase 2: write each article sequentially — progress fires after each completion
  const articles: NewsArticle[] = []
  for (const [i, plan] of plans.entries()) {
    let written: WrittenArticle
    try {
      written = await writeArticle(client, plan, year, quarter, i)
    } catch {
      written = { headline: '제목 없음', subheadline: '', body: '', summary: '', author: '편집부', publishedAt: '' }
    }
    articles.push({
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
      priceImpact:     plan.priceImpact     ?? {},
      targetType:      plan.targetType === 'global' ? 'global' : 'local',
      targetSector:    plan.targetSector,
    })
    onProgress?.(i + 1)
  }

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
