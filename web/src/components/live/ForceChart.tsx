import { useRef, useEffect } from 'react';
import uPlot from 'uplot';
import { useLiveStore } from '../../stores/liveStore.ts';
import { FINGER_NAMES, FINGER_COLORS, TOTAL_COLOR } from '../../constants/fingers.ts';
import { useAnimationFrame } from '../../hooks/useAnimationFrame.ts';

export function ForceChart() {
  const containerRef = useRef<HTMLDivElement>(null);
  const plotRef = useRef<uPlot | null>(null);
  const lastRenderedPos = useRef(0);

  // Build uPlot once
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;

    const opts: uPlot.Options = {
      width: el.clientWidth,
      height: el.clientHeight,
      cursor: { show: false },
      legend: { show: false },
      scales: {
        x: { time: false },
        y: { auto: true, range: (_u, min, max) => [Math.min(0, min), Math.max(2, max * 1.1)] },
      },
      axes: [
        {
          stroke: '#8892a8',
          grid: { stroke: '#2e334530' },
          ticks: { stroke: '#2e3345' },
          values: (_u, vals) => vals.map(v => (v / 1000).toFixed(0) + 's'),
          font: '11px Sora, sans-serif',
        },
        {
          stroke: '#8892a8',
          grid: { stroke: '#2e334530' },
          ticks: { stroke: '#2e3345' },
          values: (_u, vals) => vals.map(v => v.toFixed(1)),
          label: 'kg',
          font: '11px Sora, sans-serif',
        },
      ],
      series: [
        {},
        { label: 'Total', stroke: TOTAL_COLOR, width: 2.5 },
        { label: FINGER_NAMES[0], stroke: FINGER_COLORS[0], width: 1.5 },
        { label: FINGER_NAMES[1], stroke: FINGER_COLORS[1], width: 1.5 },
        { label: FINGER_NAMES[2], stroke: FINGER_COLORS[2], width: 1.5 },
        { label: FINGER_NAMES[3], stroke: FINGER_COLORS[3], width: 1.5 },
      ],
    };

    const emptyData: uPlot.AlignedData = [new Float64Array(0), new Float64Array(0), new Float64Array(0), new Float64Array(0), new Float64Array(0), new Float64Array(0)];
    const plot = new uPlot(opts, emptyData, el);
    plotRef.current = plot;

    const resizeObs = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) plot.setSize({ width, height });
    });
    resizeObs.observe(el);

    return () => {
      resizeObs.disconnect();
      plot.destroy();
      plotRef.current = null;
    };
  }, []);

  // RAF-synced data push
  useAnimationFrame(() => {
    const plot = plotRef.current;
    if (!plot) return;

    const state = useLiveStore.getState();
    if (state.writePos === lastRenderedPos.current) return;
    lastRenderedPos.current = state.writePos;

    const len = state.bufferLength;
    if (len === 0) return;

    // Build sub-arrays from ring buffer
    const wp = state.writePos;
    const capacity = state.capacity;
    const start = wp > capacity ? wp % capacity : 0;

    let times: Float64Array;
    let total: Float64Array;
    const fingers: Float64Array[] = [];

    if (start === 0) {
      // No wrap
      times = state.timeSeries.subarray(0, len);
      total = state.totalSeries.subarray(0, len);
      for (let i = 0; i < 4; i++) fingers.push(state.fingerSeries[i].subarray(0, len));
    } else {
      // Wrapped — need to concat
      times = new Float64Array(len);
      total = new Float64Array(len);
      const f0 = new Float64Array(len);
      const f1 = new Float64Array(len);
      const f2 = new Float64Array(len);
      const f3 = new Float64Array(len);

      const tailLen = capacity - start;
      times.set(state.timeSeries.subarray(start, capacity), 0);
      times.set(state.timeSeries.subarray(0, len - tailLen), tailLen);
      total.set(state.totalSeries.subarray(start, capacity), 0);
      total.set(state.totalSeries.subarray(0, len - tailLen), tailLen);

      for (let i = 0; i < 4; i++) {
        const dst = [f0, f1, f2, f3][i];
        dst.set(state.fingerSeries[i].subarray(start, capacity), 0);
        dst.set(state.fingerSeries[i].subarray(0, len - tailLen), tailLen);
        fingers.push(dst);
      }
    }

    plot.setData([times, total, fingers[0], fingers[1], fingers[2], fingers[3]], false);
    plot.redraw();
  });

  return (
    <div ref={containerRef} className="w-full h-full min-h-[300px]" />
  );
}
