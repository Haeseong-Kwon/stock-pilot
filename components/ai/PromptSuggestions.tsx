'use client'

const SUGGESTIONS = [
  'Mark days that dropped more than 5% in the last year',
  'Add RSI and mark oversold days',
  'Find volume spikes',
  'Find support and resistance over the last 6 months',
  '골든크로스 발생한 곳 표시',
  '볼린저밴드 아래로 이탈한 곳 보여줘',
]

export function PromptSuggestions({ onPick }: { onPick: (prompt: string) => void }) {
  return (
    <div className="px-3 pb-3">
      <p className="pb-2 text-[10.5px] tracking-wide text-faint uppercase">Try</p>
      <div className="flex flex-wrap gap-1.5">
        {SUGGESTIONS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => onPick(prompt)}
            className="rounded-full border border-line bg-raised px-2.5 py-1 text-left text-[11px] text-muted transition-colors hover:border-accent/40 hover:text-text"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  )
}
