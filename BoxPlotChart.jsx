import { useEffect, useRef, useState } from 'react';

/**
 * BoxPlotChart — animated value-distribution chart (Tukey box plots).
 *
 * Each column animates by expanding from its median line outward:
 *   • whisker line + caps grow from the median toward min/max
 *   • IQR box grows from the median toward q1/q3
 *   • the green median line fades in once the box has some size
 * Columns are staggered so they appear in a wave from left to right.
 *
 * The box fill uses the same animated light→dark blue gradient as the gauge
 * (#3f85ff → #73c6ed, breathing on a 6s loop).
 *
 * Usage:
 *   const data = [
 *     { label: 'bid_price', min: 0.03, q1: 0.60, median: 0.70, q3: 0.78, max: 0.99 },
 *     ...
 *   ];
 *   <BoxPlotChart data={data} />
 *
 * Props:
 *   data       Array<{ label, min, q1, median, q3, max }>
 *   yMin       number, bottom of the y-axis (default 0)
 *   yMax       number, top of the y-axis (default 1)
 *   yTicks     number[], gridline values (default [0, .2, .4, .6, .8, 1])
 *   duration   ms, total animation length (default 1600)
 *   replayKey  change this to replay the animation
 *   boxColor   solid fill color for the IQR halves (default '#2929d4')
 *   medianColor color of the median line (default '#2f9a4a')
 *   className / style — applied to the wrapper <svg>
 */
export default function BoxPlotChart({
  data,
  yMin = 0,
  yMax = 1,
  yTicks = [0, 0.2, 0.4, 0.6, 0.8, 1.0],
  duration = 1600,
  replayKey,
  boxColor = '#2929d4',
  medianColor = '#2f9a4a',
  className,
  style,
}) {
  const W = 880;
  const H = 460;
  const PAD = { top: 24, right: 32, bottom: 48, left: 56 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const y = (v) => PAD.top + plotH - ((v - yMin) / (yMax - yMin)) * plotH;
  const colW = data.length ? plotW / data.length : plotW;
  const cx = (i) => PAD.left + colW * (i + 0.5);

  const progress = useAnimatedProgress(duration, replayKey);
  const localProgress = (i) => clamp((progress - i * 0.08) / 0.6, 0, 1);

  const BOX_W = Math.min(72, colW * 0.55);
  const CAP_W = BOX_W * 0.38;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ width: '100%', height: 'auto', display: 'block', ...style }}
    >
      {/* y-axis grid + tick labels */}
      {yTicks.map((t) => (
        <g key={t}>
          <line
            x1={PAD.left} x2={W - PAD.right}
            y1={y(t)} y2={y(t)}
            stroke="#e8ecf1" strokeWidth="1" strokeDasharray="2 4"
          />
          <text
            x={PAD.left - 12} y={y(t) + 4}
            textAnchor="end" fontSize="12" fill="#8a8f97"
            fontFamily="Inter, sans-serif"
          >
            {Number.isFinite(t) ? t.toFixed(1) : String(t)}
          </text>
        </g>
      ))}

      {/* one box plot per column */}
      {data.map((d, i) => {
        const p = localProgress(i);
        const cX = cx(i);
        const medY = y(d.median);

        const minY = medY + (y(d.min) - medY) * p;
        const maxY = medY + (y(d.max) - medY) * p;
        const q1Y  = medY + (y(d.q1)  - medY) * p;
        const q3Y  = medY + (y(d.q3)  - medY) * p;

        // gap between the top and bottom halves of the IQR box,
        // through which the median line passes
        const GAP = 6;
        const topH    = Math.max(0, medY - GAP / 2 - q3Y);
        const bottomH = Math.max(0, q1Y - (medY + GAP / 2));

        const medOpacity = clamp((p - 0.25) / 0.35, 0, 1);

        return (
          <g key={d.label ?? i}>
            {/* upper whisker — from top cap down to top of upper box */}
            <line
              x1={cX} x2={cX}
              y1={maxY} y2={Math.min(q3Y, medY - GAP / 2)}
              stroke={boxColor} strokeWidth="1" strokeLinecap="round"
            />
            {/* lower whisker — from bottom of lower box down to bottom cap */}
            <line
              x1={cX} x2={cX}
              y1={Math.max(q1Y, medY + GAP / 2)} y2={minY}
              stroke={boxColor} strokeWidth="1" strokeLinecap="round"
            />
            {/* whisker caps */}
            <line
              x1={cX - CAP_W / 2} x2={cX + CAP_W / 2}
              y1={maxY} y2={maxY}
              stroke={boxColor} strokeWidth="1.5" strokeLinecap="round"
            />
            <line
              x1={cX - CAP_W / 2} x2={cX + CAP_W / 2}
              y1={minY} y2={minY}
              stroke={boxColor} strokeWidth="1.5" strokeLinecap="round"
            />
            {/* IQR — top half (Q3 → just above median): rounded only on top corners */}
            {topH > 0 && (
              <path
                d={roundedRectPath(
                  cX - BOX_W / 2, q3Y, BOX_W, topH,
                  { tl: 8, tr: 8, br: 0, bl: 0 }
                )}
                fill={boxColor}
              />
            )}
            {/* IQR — bottom half (just below median → Q1): rounded only on bottom corners */}
            {bottomH > 0 && (
              <path
                d={roundedRectPath(
                  cX - BOX_W / 2, medY + GAP / 2, BOX_W, bottomH,
                  { tl: 0, tr: 0, br: 8, bl: 8 }
                )}
                fill={boxColor}
              />
            )}
            {/* median line — passes through the gap */}
            <line
              x1={cX - BOX_W / 2 - 4} x2={cX + BOX_W / 2 + 4}
              y1={medY} y2={medY}
              stroke={medianColor} strokeWidth="1.5" strokeLinecap="round"
              opacity={medOpacity}
            />
            {/* column label */}
            <text
              x={cX} y={H - 16}
              textAnchor="middle" fontSize="13" fill="#5b6068"
              fontFamily="Inter, sans-serif"
            >
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ----------------------------- internals ----------------------------- */
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

// Rectangle path with selectively rounded corners.
// corners: { tl, tr, br, bl } — radius per corner (0 = square).
function roundedRectPath(x, y, w, h, corners) {
  const { tl = 0, tr = 0, br = 0, bl = 0 } = corners;
  return [
    `M ${x + tl} ${y}`,
    `H ${x + w - tr}`,
    tr ? `A ${tr} ${tr} 0 0 1 ${x + w} ${y + tr}` : '',
    `V ${y + h - br}`,
    br ? `A ${br} ${br} 0 0 1 ${x + w - br} ${y + h}` : '',
    `H ${x + bl}`,
    bl ? `A ${bl} ${bl} 0 0 1 ${x} ${y + h - bl}` : '',
    `V ${y + tl}`,
    tl ? `A ${tl} ${tl} 0 0 1 ${x + tl} ${y}` : '',
    'Z',
  ].filter(Boolean).join(' ');
}

// drives a 0 → 1 progress value with ease-out-cubic; replays when replayKey changes
function useAnimatedProgress(duration, replayKey) {
  const [p, setP] = useState(0);
  const rafRef = useRef();
  useEffect(() => {
    setP(0);
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      setP(easeOutCubic(t));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [duration, replayKey]);
  return p;
}
