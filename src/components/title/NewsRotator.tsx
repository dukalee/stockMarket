import { useEffect, useState } from 'react'
import { TITLE_NEWS } from '../../data/titleNews'

const ROTATE_MS = 6000   // n초마다 다음 기사로 자동 슬라이드

/** 타이틀 화면 "오늘의 기사" — 장식용 기사 3개가 옆으로 밀리며 자동으로 넘어간다 */
export default function NewsRotator() {
  const [idx, setIdx]       = useState(0)
  const [paused, setPaused] = useState(false)
  const [cycle, setCycle]   = useState(0)   // 타이머가 다시 시작될 때마다 올라가 진행 막대를 처음부터 그린다

  useEffect(() => {
    if (paused) return
    const id = window.setInterval(() => setIdx(i => (i + 1) % TITLE_NEWS.length), ROTATE_MS)
    return () => window.clearInterval(id)
  }, [paused, cycle])

  const goTo = (i: number) => { setIdx(i); setCycle(c => c + 1) }
  const resume = () => { setPaused(false); setCycle(c => c + 1) }

  return (
    <section
      className="flex flex-col"
      aria-label="오늘의 기사"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={resume}
      onFocus={() => setPaused(true)}
      onBlur={resume}
    >
      <div className="flex justify-between items-baseline border-b-2 border-ink pb-2 relative">
        <h2 className="font-serif font-black text-xl m-0">오늘의 기사</h2>
        <div className="flex items-center gap-1.5">
          {TITLE_NEWS.map((n, i) => (
            <button
              key={n.headline}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`${i + 1}번째 기사 보기`}
              aria-current={i === idx}
              className="w-6 h-6 flex items-center justify-center"
            >
              <span className={`block w-2.5 h-2.5 border border-ink ${i === idx ? 'bg-ink' : 'bg-transparent'}`} />
            </button>
          ))}
        </div>
        {/* 다음 기사까지 남은 시간 */}
        <span
          key={`${idx}-${cycle}`}
          aria-hidden="true"
          className="news-progress absolute left-0 -bottom-0.5 h-0.5 w-full bg-up"
          style={{ animationDuration: `${ROTATE_MS}ms`, animationPlayState: paused ? 'paused' : 'running' }}
        />
      </div>

      <div className="overflow-hidden">
        <div className="news-track flex" style={{ transform: `translateX(-${idx * 100}%)` }}>
          {TITLE_NEWS.map((a, i) => (
            <article
              key={a.headline}
              aria-hidden={i !== idx}
              className="w-full shrink-0 pt-4 pr-1 flex flex-col gap-2"
            >
              <span className="text-xs font-bold text-up">{a.sector}</span>
              <h3 className="font-serif font-black text-[24px] leading-snug m-0">{a.headline}</h3>
              <p className="m-0 text-[15px] text-ink-soft">{a.subheadline}</p>
              <div className="text-[15px] leading-[1.8] text-ink-soft flex flex-col gap-2 pt-1">
                {a.paragraphs.map(p => <p key={p} className="m-0">{p}</p>)}
              </div>
              <p className="m-0 text-xs text-mute pt-1">{a.author}, {a.publishedAt}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
