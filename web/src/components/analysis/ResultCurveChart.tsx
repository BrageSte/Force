import { useEffect, useRef } from 'react';
import uPlot from 'uplot';

export interface ResultCurveSeries {
  label: string;
  color: string;
  values: number[];
  width?: number;
  opacity?: number;
}

interface ResultCurveChartProps {
  timesMs: number[];
  series: ResultCurveSeries[];
  yLabel: string;
  height?: number;
  zeroLine?: boolean;
}

function colorWithOpacity(color: string, opacity = 1): string {
  const normalized = color.trim();
  if (!normalized.startsWith('#')) return normalized;
  const hex = normalized.slice(1);
  if (hex.length !== 6) return normalized;
  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
}

export function ResultCurveChart({
  timesMs,
  series,
  yLabel,
  height = 220,
  zeroLine = false,
}: ResultCurveChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || timesMs.length === 0 || series.length === 0) return;
    const el = containerRef.current;

    const opts: uPlot.Options = {
      width: Math.max(el.clientWidth, 320),
      height,
      cursor: { drag: { x: false, y: false } },
      legend: { show: false },
      scales: {
        x: { time: false },
        y: {
          auto: true,
          range: (_u, min, max) => {
            const span = Math.max(1, max - min);
            const pad = span * 0.14;
            const low = zeroLine ? Math.min(min, 0) - pad : min - pad;
            const high = zeroLine ? Math.max(max, 0) + pad : max + pad;
            return [low, high];
          },
        },
      },
      axes: [
        {
          stroke: '#8892a8',
          grid: { stroke: '#2e334530' },
          ticks: { stroke: '#2e3345' },
          values: (_u, values) => values.map(value => `${(value / 1000).toFixed(1)}s`),
          font: '11px Sora, sans-serif',
        },
        {
          stroke: '#8892a8',
          grid: { stroke: '#2e334530' },
          ticks: { stroke: '#2e3345' },
          values: (_u, values) => values.map(value => value.toFixed(1)),
          label: yLabel,
          font: '11px Sora, sans-serif',
        },
      ],
      series: [
        {},
        ...series.map(item => ({
          label: item.label,
          stroke: colorWithOpacity(item.color, item.opacity ?? 1),
          width: item.width ?? 1.8,
        })),
      ],
      hooks: zeroLine ? {
        draw: [
          (plot: uPlot) => {
            const zeroY = plot.valToPos(0, 'y', true);
            const { left, width } = plot.bbox;
            const ctx = plot.ctx;
            ctx.save();
            ctx.beginPath();
            ctx.strokeStyle = '#94a3b866';
            ctx.setLineDash([5, 4]);
            ctx.lineWidth = 1;
            ctx.moveTo(left, zeroY);
            ctx.lineTo(left + width, zeroY);
            ctx.stroke();
            ctx.restore();
          },
        ],
      } : undefined,
    };

    const data: uPlot.AlignedData = [
      Float64Array.from(timesMs),
      ...series.map(item => Float64Array.from(item.values)),
    ];

    const plot = new uPlot(opts, data, el);
    const resizeObserver = new ResizeObserver(entries => {
      const entry = entries[0];
      if (!entry) return;
      const width = Math.max(entry.contentRect.width, 320);
      plot.setSize({ width, height });
    });

    resizeObserver.observe(el);

    return () => {
      resizeObserver.disconnect();
      plot.destroy();
    };
  }, [height, series, timesMs, yLabel, zeroLine]);

  return <div ref={containerRef} className="w-full" style={{ minHeight: `${height}px` }} />;
}
