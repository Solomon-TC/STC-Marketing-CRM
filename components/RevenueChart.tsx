'use client';

import { useMemo, useRef, useState } from 'react';

export interface RevenuePoint {
  date: string; // ISO timestamp of the event (e.g. a deal's won_at)
  amount: number; // that event's contribution
}

const WIDTH = 600;
const HEIGHT = 220;
const PAD_LEFT = 56;
const PAD_RIGHT = 16;
const PAD_TOP = 16;
const PAD_BOTTOM = 28;

function formatMoney(n: number) {
  return `$${Math.round(n).toLocaleString()}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// A cumulative step chart: revenue only accrues at discrete events (a deal
// being won), so a step line is the accurate shape -- a smooth diagonal
// would imply revenue trickled in gradually between events, which it didn't.
export default function RevenueChart({ points, color }: { points: RevenuePoint[]; color: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverX, setHoverX] = useState<number | null>(null);

  const sorted = useMemo(
    () => [...points].filter((p) => p.date).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [points]
  );

  if (sorted.length === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center text-sm text-ink/40">
        No revenue recorded yet.
      </div>
    );
  }

  const cumulative: { t: number; date: string; value: number }[] = [];
  let running = 0;
  for (const p of sorted) {
    running += p.amount;
    cumulative.push({ t: new Date(p.date).getTime(), date: p.date, value: running });
  }
  const now = Date.now();
  const minT = cumulative[0].t;
  const maxT = Math.max(now, cumulative[cumulative.length - 1].t);
  const maxValue = cumulative[cumulative.length - 1].value;
  const plotW = WIDTH - PAD_LEFT - PAD_RIGHT;
  const plotH = HEIGHT - PAD_TOP - PAD_BOTTOM;

  function xFor(t: number) {
    if (maxT === minT) return PAD_LEFT;
    return PAD_LEFT + ((t - minT) / (maxT - minT)) * plotW;
  }
  function yFor(v: number) {
    if (maxValue === 0) return PAD_TOP + plotH;
    return PAD_TOP + plotH - (v / maxValue) * plotH;
  }

  // Step path: hold each value flat until the next event, then jump; the
  // final value is held flat out to "now" on the right edge.
  const segments: string[] = [`M ${xFor(cumulative[0].t)} ${yFor(0)}`];
  segments.push(`L ${xFor(cumulative[0].t)} ${yFor(cumulative[0].value)}`);
  for (let i = 1; i < cumulative.length; i++) {
    segments.push(`L ${xFor(cumulative[i].t)} ${yFor(cumulative[i - 1].value)}`);
    segments.push(`L ${xFor(cumulative[i].t)} ${yFor(cumulative[i].value)}`);
  }
  segments.push(`L ${xFor(maxT)} ${yFor(cumulative[cumulative.length - 1].value)}`);
  const linePath = segments.join(' ');
  const areaPath = `${linePath} L ${xFor(maxT)} ${yFor(0)} L ${xFor(cumulative[0].t)} ${yFor(0)} Z`;

  const gridLines = 4;
  const gridValues = Array.from({ length: gridLines + 1 }, (_, i) => (maxValue / gridLines) * i);

  function handleMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = ((e.clientX - rect.left) / rect.width) * WIDTH;
    setHoverX(Math.min(Math.max(px, PAD_LEFT), WIDTH - PAD_RIGHT));
  }

  let hoverPoint: { t: number; date: string; value: number } | null = null;
  if (hoverX != null) {
    const hoverT = minT + ((hoverX - PAD_LEFT) / plotW) * (maxT - minT);
    let idx = 0;
    for (let i = 0; i < cumulative.length; i++) {
      if (cumulative[i].t <= hoverT) idx = i;
    }
    hoverPoint = { ...cumulative[idx], t: hoverT };
  }

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full"
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverX(null)}
      >
        {gridValues.map((v, i) => (
          <g key={i}>
            <line
              x1={PAD_LEFT}
              x2={WIDTH - PAD_RIGHT}
              y1={yFor(v)}
              y2={yFor(v)}
              stroke="currentColor"
              className="text-ink/10"
              strokeWidth={1}
            />
            <text x={PAD_LEFT - 8} y={yFor(v) + 4} textAnchor="end" className="fill-ink/40 text-[10px]">
              {formatMoney(v)}
            </text>
          </g>
        ))}

        <path d={areaPath} fill={color} opacity={0.12} />
        <path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        <text x={PAD_LEFT} y={HEIGHT - 8} className="fill-ink/40 text-[10px]">
          {formatDate(cumulative[0].date)}
        </text>
        <text x={WIDTH - PAD_RIGHT} y={HEIGHT - 8} textAnchor="end" className="fill-ink/40 text-[10px]">
          Today
        </text>

        {hoverPoint && (
          <>
            <line
              x1={hoverX!}
              x2={hoverX!}
              y1={PAD_TOP}
              y2={HEIGHT - PAD_BOTTOM}
              stroke="currentColor"
              className="text-ink/20"
              strokeWidth={1}
            />
            <circle cx={hoverX!} cy={yFor(hoverPoint.value)} r={4} fill={color} stroke="white" strokeWidth={1.5} />
          </>
        )}
      </svg>

      {hoverPoint && (
        <div
          className="pointer-events-none absolute top-1 rounded-md border border-black/10 bg-white px-2 py-1 text-xs shadow-md"
          style={{
            left: `${Math.min(Math.max((hoverX! / WIDTH) * 100, 10), 82)}%`,
          }}
        >
          <p className="font-medium text-ink">{formatMoney(hoverPoint.value)}</p>
          <p className="text-ink/50">as of {formatDate(new Date(hoverPoint.t).toISOString())}</p>
        </div>
      )}
    </div>
  );
}
