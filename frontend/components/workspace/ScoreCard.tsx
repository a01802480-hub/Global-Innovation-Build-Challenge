import { STATUS } from "@/lib/format";

export type ScoreTone = "good" | "warning" | "critical" | "neutral";

interface ScoreCardProps {
  source: string;
  title: string;
  tone: ScoreTone;
  toneLabel: string;
  children: React.ReactNode;
  footnote?: string;
}

const TONE_COLOR: Record<ScoreTone, string> = {
  good: STATUS.good,
  warning: STATUS.warning,
  critical: STATUS.critical,
  neutral: "#898781",
};

/** One prediction source rendered as a status card — icon + label, never color alone. */
export function ScoreCard({ source, title, tone, toneLabel, children, footnote }: ScoreCardProps) {
  const color = TONE_COLOR[tone];
  return (
    <div className="glass-card flex flex-col p-6" style={{ boxShadow: `0 20px 40px rgba(0,0,0,0.05), 0 0 0 1px ${color}22` }}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[10px] tracking-[0.18em] text-mist/50 uppercase">{source}</span>
        <StatusIcon tone={tone} />
      </div>
      <h3 className="text-base font-semibold text-frost">{title}</h3>
      <span
        className="mt-2 inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium"
        style={{ borderColor: `${color}55`, color, background: `${color}14` }}
      >
        <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
        {toneLabel}
      </span>
      <dl className="mt-4 space-y-2 text-sm">{children}</dl>
      {footnote && <p className="mt-4 text-[11px] leading-relaxed text-mist/50">{footnote}</p>}
    </div>
  );
}

export function ScoreRow({ k, v, mono }: { k: string; v: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-mist/70">{k}</dt>
      <dd className={`stat-num text-right font-medium text-frost/90 ${mono ? "font-mono text-xs" : ""}`}>{v}</dd>
    </div>
  );
}

function StatusIcon({ tone }: { tone: ScoreTone }) {
  const common = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor" } as const;
  const color = TONE_COLOR[tone];
  switch (tone) {
    case "good":
      return (
        <svg {...common} style={{ color }} aria-hidden>
          <circle cx="12" cy="12" r="9" strokeWidth="1.8" />
          <path d="M8 12.5l2.6 2.6L16 9.5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "warning":
      return (
        <svg {...common} style={{ color }} aria-hidden>
          <path d="M12 4L21 20H3L12 4Z" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M12 10v4.5" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="12" cy="17.2" r="0.9" fill="currentColor" stroke="none" />
        </svg>
      );
    case "critical":
      return (
        <svg {...common} style={{ color }} aria-hidden>
          <circle cx="12" cy="12" r="9" strokeWidth="1.8" />
          <path d="M9 9l6 6M15 9l-6 6" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    default:
      return (
        <svg {...common} style={{ color }} aria-hidden>
          <circle cx="12" cy="12" r="9" strokeWidth="1.8" />
          <path d="M9 12h6" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
  }
}
