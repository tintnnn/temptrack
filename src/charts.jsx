import { useId, useState } from "react";

export function AreaChart({
  data,
  labels,
  color = "#1c8a62",
  height = 168,
  unit = "",
  fillId,
}) {
  const reactId = useId().replace(/:/g, "");
  const id = fillId || reactId;
  const [hover, setHover] = useState(null);
  const width = 640;
  const padX = 16;
  const padY = 16;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = Math.max(max - min, 0.8);
  const yFor = (v) => padY + ((max - v) / span) * (height - padY * 2);
  const xFor = (i) => padX + (i / Math.max(data.length - 1, 1)) * (width - padX * 2);
  const points = data.map((v, i) => [xFor(i), yFor(v)]);
  const line = points.map((p) => p.join(",")).join(" ");
  const area = `${padX},${height - 8} ${line} ${width - padX},${height - 8}`;
  const grids = [0.2, 0.5, 0.8].map((g) => padY + g * (height - padY * 2));

  return (
    <div className="chart">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = ((e.clientX - rect.left) / rect.width) * width;
          let best = 0;
          let dist = Infinity;
          points.forEach((p, i) => {
            const d = Math.abs(p[0] - x);
            if (d < dist) {
              dist = d;
              best = i;
            }
          });
          setHover(best);
        }}
      >
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {grids.map((y) => (
          <line key={y} x1="0" y1={y} x2={width} y2={y} className="grid-line" />
        ))}
        <polygon points={area} fill={`url(#${id})`} />
        <polyline points={line} fill="none" stroke={color} strokeWidth="2.6" vectorEffect="non-scaling-stroke" />
        {hover != null && (
          <>
            <line x1={points[hover][0]} y1="8" x2={points[hover][0]} y2={height - 8} stroke={color} strokeOpacity="0.35" strokeDasharray="3 3" />
            <circle cx={points[hover][0]} cy={points[hover][1]} r="5" fill="#fff" stroke={color} strokeWidth="2.5" />
          </>
        )}
      </svg>
      {hover != null && (
        <div
          className="chart-tip"
          style={{ left: `${(points[hover][0] / width) * 100}%` }}
        >
          <strong>
            {data[hover]}
            {unit}
          </strong>
          <span>{labels?.[hover]}</span>
        </div>
      )}
      {labels && (
        <div className="chart-labels">
          {labels.filter((_, i) => i % Math.ceil(labels.length / 5) === 0 || i === labels.length - 1).map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
      )}
    </div>
  );
}
