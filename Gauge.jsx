import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Gauge — animated semicircular gauge with a light→dark blue gradient
 * and radial tick texture inside the arc.
 *
 * Usage:
 *   <Gauge value={90} />
 *   <Gauge value={75} duration={1800} className="w-64" />
 *
 * Props:
 *   value     number 0–100, target value the arc fills to
 *   duration  ms, animation length (default 2200)
 *   className optional className applied to the wrapper (size it from here)
 *   style     optional inline style applied to the wrapper
 *   replayKey when this changes the fill animation replays from 0
 */
export default function Gauge({
  value = 90,
  duration = 2200,
  className,
  style,
  replayKey,
}) {
  const animated = useAnimatedValue(value, duration, replayKey);

  const trackPath = useMemo(() => arcPath(0, 100), []);
  const fillPath = arcPath(0, Math.max(0.001, animated));

  // radial tick marks every 1.6° across the 180° arc
  const tickAngles = useMemo(() => {
    const arr = [];
    for (let deg = 0; deg <= 180; deg += 1.6) arr.push(deg);
    return arr;
  }, []);

  // unique IDs so multiple gauges on the same page don't collide
  const uid = useMemo(
    () => 'g' + Math.random().toString(36).slice(2, 9),
    []
  );
  const gradId = `${uid}-grad`;
  const fillMaskId = `${uid}-fill`;
  const trackMaskId = `${uid}-track`;

  return (
    <div
      className={className}
      style={{
        width: '100%',
        aspectRatio: '2 / 1.15',
        ...style,
      }}
    >
      <svg
        viewBox="0 0 200 115"
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: '100%', height: '100%', display: 'block', overflow: 'visible' }}
      >
        <defs>
          {/* animated light→dark blue gradient (3f85ff → 73c6ed, breathing) */}
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#3f85ff">
              <animate
                attributeName="stop-color"
                values="#3f85ff;#4a90ff;#3f85ff"
                dur="6s"
                repeatCount="indefinite"
              />
            </stop>
            <stop offset="100%" stopColor="#73c6ed">
              <animate
                attributeName="stop-color"
                values="#73c6ed;#84d0f2;#73c6ed"
                dur="6s"
                repeatCount="indefinite"
              />
            </stop>
          </linearGradient>

          {/* mask = currently filled portion of the arc */}
          <mask id={fillMaskId}>
            <path
              d={fillPath}
              fill="none"
              stroke="white"
              strokeWidth={STROKE}
              strokeLinecap="round"
            />
          </mask>

          {/* mask = full arc (for the unfilled track) */}
          <mask id={trackMaskId}>
            <path
              d={trackPath}
              fill="none"
              stroke="white"
              strokeWidth={STROKE}
              strokeLinecap="round"
            />
          </mask>
        </defs>

        {/* unfilled track + faint ticks */}
        <g mask={`url(#${trackMaskId})`}>
          <rect x="0" y="0" width="200" height="115" fill="#eef0f4" />
          {tickAngles.map((deg, i) => {
            const outer = polar(deg, RADIUS + 3.5);
            const inner = polar(deg, RADIUS - 3.5);
            return (
              <line
                key={i}
                x1={outer.x}
                y1={outer.y}
                x2={inner.x}
                y2={inner.y}
                stroke="rgba(140,150,165,0.35)"
                strokeWidth="0.35"
                strokeLinecap="round"
              />
            );
          })}
        </g>

        {/* blue gradient fill + slate ticks, clipped to filled portion */}
        <g mask={`url(#${fillMaskId})`}>
          <rect x="0" y="0" width="200" height="115" fill={`url(#${gradId})`} />
          {tickAngles.map((deg, i) => {
            const outer = polar(deg, RADIUS + 3.5);
            const inner = polar(deg, RADIUS - 3.5);
            return (
              <line
                key={i}
                x1={outer.x}
                y1={outer.y}
                x2={inner.x}
                y2={inner.y}
                stroke="rgba(45, 75, 130, 0.6)"
                strokeWidth="0.4"
                strokeLinecap="round"
              />
            );
          })}
        </g>
      </svg>
    </div>
  );
}

/* ----------------------------- internals ----------------------------- */

// SVG viewBox is 200×105. Arc center sits at (100, 100), so the semicircle
// (radius 78) lives entirely in the top of the viewBox.
const CENTER = { x: 100, y: 100 };
const RADIUS = 78;
const STROKE = 28;

// degree → point on the gauge circle (SVG y-axis is flipped)
function polar(deg, r = RADIUS) {
  const a = (Math.PI / 180) * deg;
  return { x: CENTER.x + r * Math.cos(a), y: CENTER.y - r * Math.sin(a) };
}

// map 0–100 → angle along the semicircle (180° on the left → 0° on the right)
function valueToAngle(v) {
  return 180 - (v / 100) * 180;
}

// SVG path describing the arc from value vStart to value vEnd
function arcPath(vStart, vEnd, r = RADIUS) {
  const a1 = valueToAngle(vStart);
  const a2 = valueToAngle(vEnd);
  const p1 = polar(a1, r);
  const p2 = polar(a2, r);
  const largeArc = Math.abs(a2 - a1) > 180 ? 1 : 0;
  return `M ${p1.x} ${p1.y} A ${r} ${r} 0 ${largeArc} 1 ${p2.x} ${p2.y}`;
}

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

// animates a value from 0 → target with ease-out-cubic over `duration` ms.
// replayKey lets the parent re-trigger the animation by bumping a counter.
function useAnimatedValue(target, duration, replayKey) {
  const [val, setVal] = useState(0);
  const rafRef = useRef();

  useEffect(() => {
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      setVal(target * easeOutCubic(t));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration, replayKey]);

  return val;
}
