const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
const LINE = 1.25  // em — 한 칸의 높이

/**
 * 숫자가 자릿수별로 위아래로 굴러가며 바뀌는 표시 (주가판 / 오도미터 느낌).
 * 쉼표, 소수점 같은 숫자 외 문자는 그대로 둔다.
 * 자릿수는 오른쪽 끝 기준으로 맞춰서, 숫자가 바뀌어도 같은 자리 칸이 계속 굴러간다.
 */
export default function RollingNumber({ value, className = '' }: { value: string; className?: string }) {
  const chars = value.split('')

  return (
    <span
      role="img"
      aria-label={value}
      className={`inline-flex align-middle ${className}`}
      style={{ height: `${LINE}em`, lineHeight: `${LINE}em` }}
    >
      {chars.map((ch, i) => {
        const key = chars.length - i   // 오른쪽에서부터의 자리 번호
        const d = ch >= '0' && ch <= '9' ? Number(ch) : null
        if (d === null) {
          return <span key={key} aria-hidden="true" style={{ height: `${LINE}em` }}>{ch}</span>
        }
        return (
          <span
            key={key}
            aria-hidden="true"
            className="inline-block overflow-hidden"
            style={{ height: `${LINE}em`, width: '0.62em', textAlign: 'center' }}
          >
            <span
              className="roll-strip flex flex-col"
              style={{ transform: `translateY(-${d * LINE}em)` }}
            >
              {DIGITS.map(n => (
                <span key={n} style={{ height: `${LINE}em` }}>{n}</span>
              ))}
            </span>
          </span>
        )
      })}
    </span>
  )
}
