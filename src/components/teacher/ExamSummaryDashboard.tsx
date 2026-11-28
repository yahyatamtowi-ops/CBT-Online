import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock,
  TrendingUp,
} from 'lucide-react';
import type {
  ExamAttempt,
  ExamPackage,
  ViolationLog,
} from '../../types/cbt';
import {
  computeExamSummaryAnalytics,
  type ClassScoreSummary,
  type CompletionTimeBin,
} from '../../utils/examSummaryAnalytics';

interface ExamSummaryDashboardProps {
  packages: ExamPackage[];
  attempts: ExamAttempt[];
  violations: ViolationLog[];
  onOpenProctoring: (packageId: string) => void;
}

function useContainerWidth(ref: React.RefObject<HTMLDivElement | null>) {
  const [width, setWidth] = useState(460);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = () => {
      const next = Math.floor(el.getBoundingClientRect().width);
      if (next > 160) setWidth(next);
    };

    update();
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => update());
      observer.observe(el);
      return () => observer.disconnect();
    }
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [ref]);

  return width;
}

function useIsDarkMode() {
  const [isDark, setIsDark] = useState(() =>
    typeof document !== 'undefined'
      ? document.documentElement.classList.contains('dark')
      : false
  );

  useEffect(() => {
    if (typeof MutationObserver === 'undefined') return;
    const obs = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    return () => obs.disconnect();
  }, []);

  return isDark;
}

export function ExamSummaryDashboard({
  packages,
  attempts,
  violations,
  onOpenProctoring,
}: ExamSummaryDashboardProps) {
  const [filterPackageId, setFilterPackageId] = useState<string>('ALL');
  const [hoveredBin, setHoveredBin] = useState<CompletionTimeBin | null>(null);
  const [hoveredClass, setHoveredClass] = useState<ClassScoreSummary | null>(
    null
  );

  const timeChartWrapRef = useRef<HTMLDivElement | null>(null);
  const timeSvgRef = useRef<SVGSVGElement | null>(null);
  const scoreChartWrapRef = useRef<HTMLDivElement | null>(null);
  const scoreSvgRef = useRef<SVGSVGElement | null>(null);

  const timeChartWidth = useContainerWidth(timeChartWrapRef);
  const scoreChartWidth = useContainerWidth(scoreChartWrapRef);
  const isDark = useIsDarkMode();

  const effectiveFilterId =
    filterPackageId !== 'ALL' &&
    !packages.some((p) => p.id === filterPackageId)
      ? 'ALL'
      : filterPackageId;

  const analytics = useMemo(
    () =>
      computeExamSummaryAnalytics({
        packages,
        attempts,
        violations,
        selectedPackageId: effectiveFilterId,
      }),
    [packages, attempts, violations, effectiveFilterId]
  );

  // D3 Chart 1: Completion Time Distribution Histogram
  useEffect(() => {
    const svgEl = timeSvgRef.current;
    if (!svgEl) return;

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();

    const { bins, medianMinutes } = analytics.completionDistribution;
    if (bins.length === 0) return;

    const width = Math.max(260, timeChartWidth);
    const height = 236;
    const margin = { top: 34, right: 16, bottom: 38, left: 36 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const axisColor = isDark ? '#94a3b8' : '#64748b';
    const gridColor = isDark ? '#1e293b' : '#e2e8f0';
    const labelColor = isDark ? '#e2e8f0' : '#0f172a';

    svg.attr('viewBox', `0 0 ${width} ${height}`).attr('width', width).attr('height', height);

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3
      .scaleBand<string>()
      .domain(bins.map((b) => b.label))
      .range([0, innerW])
      .padding(0.24);

    const maxCount = Math.max(1, d3.max(bins, (b) => b.count) ?? 1);
    const yTickStep = Math.max(1, Math.ceil(maxCount / 4));
    const yTopTick = Math.ceil(maxCount / yTickStep) * yTickStep;
    const yTickValues = d3.range(0, yTopTick + 1, yTickStep);
    const y = d3
      .scaleLinear()
      .domain([0, yTopTick + yTickStep * 0.25])
      .range([innerH, 0]);

    // Horizontal gridlines
    g.append('g')
      .attr('class', 'grid')
      .call(
        d3
          .axisLeft(y)
          .tickValues(yTickValues)
          .tickSize(-innerW)
          .tickFormat(() => '')
      )
      .call((sel) => sel.select('.domain').remove())
      .call((sel) =>
        sel
          .selectAll('line')
          .attr('stroke', gridColor)
          .attr('stroke-dasharray', '2,3')
      );

    // Bars
    g.selectAll('rect.time-bar')
      .data(bins)
      .enter()
      .append('rect')
      .attr('class', 'time-bar')
      .attr('x', (d) => x(d.label) ?? 0)
      .attr('y', (d) => y(d.count))
      .attr('width', x.bandwidth())
      .attr('height', (d) => Math.max(0, innerH - y(d.count)))
      .attr('rx', 5)
      .attr('fill', (d) =>
        d.zone === 'rushed'
          ? '#d97706'
          : d.zone === 'near_limit'
            ? '#0284c7'
            : '#4f46e5'
      )
      .style('cursor', 'pointer')
      .on('mouseenter', function (_event, d) {
        d3.select(this).attr('opacity', 0.85);
        setHoveredBin(d);
      })
      .on('mouseleave', function () {
        d3.select(this).attr('opacity', 1);
        setHoveredBin(null);
      });

    // Value labels cleanly above non-zero bars
    g.selectAll('text.bar-val')
      .data(bins.filter((b) => b.count > 0))
      .enter()
      .append('text')
      .attr('class', 'bar-val')
      .attr('x', (d) => (x(d.label) ?? 0) + x.bandwidth() / 2)
      .attr('y', (d) => y(d.count) - 6)
      .attr('text-anchor', 'middle')
      .attr('font-size', '10px')
      .attr('font-weight', '600')
      .attr('font-family', 'ui-monospace, SFMono-Regular, Menlo, monospace')
      .attr('fill', labelColor)
      .text((d) => `${d.count}`);

    // Median reference vertical line
    const domainMaxMinutes = bins[bins.length - 1]?.maxMinutes ?? 60;
    if (medianMinutes > 0 && domainMaxMinutes > 0) {
      const medianX = Math.min(
        innerW,
        Math.max(0, (medianMinutes / domainMaxMinutes) * innerW)
      );
      g.append('line')
        .attr('x1', medianX)
        .attr('x2', medianX)
        .attr('y1', -10)
        .attr('y2', innerH)
        .attr('stroke', isDark ? '#38bdf8' : '#0369a1')
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '4,3');

      g.append('text')
        .attr('x', Math.min(innerW - 2, Math.max(2, medianX)))
        .attr('y', -16)
        .attr(
          'text-anchor',
          medianX > innerW * 0.72
            ? 'end'
            : medianX < innerW * 0.28
              ? 'start'
              : 'middle'
        )
        .attr('font-size', '10px')
        .attr('font-weight', '600')
        .attr('font-family', 'ui-monospace, SFMono-Regular, Menlo, monospace')
        .attr('fill', isDark ? '#38bdf8' : '#0369a1')
        .text(`Median ${medianMinutes}m`);
    }

    // Axes
    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(x).tickSizeOuter(0))
      .call((sel) => sel.select('.domain').attr('stroke', gridColor))
      .call((sel) => sel.selectAll('line').attr('stroke', gridColor))
      .call((sel) =>
        sel
          .selectAll('text')
          .attr('fill', axisColor)
          .attr('font-size', '10px')
          .attr('font-family', 'ui-monospace, SFMono-Regular, Menlo, monospace')
      );

    g.append('g')
      .call(
        d3
          .axisLeft(y)
          .tickValues(yTickValues)
          .tickFormat((d) => `${Math.round(Number(d))}`)
      )
      .call((sel) => sel.select('.domain').remove())
      .call((sel) => sel.selectAll('line').remove())
      .call((sel) =>
        sel
          .selectAll('text')
          .attr('fill', axisColor)
          .attr('font-size', '10px')
          .attr('font-family', 'ui-monospace, SFMono-Regular, Menlo, monospace')
      );
  }, [analytics.completionDistribution, timeChartWidth, isDark]);

  // D3 Chart 2: Average Score per Class Horizontal Bar Chart with KKM Reference Line
  useEffect(() => {
    const svgEl = scoreSvgRef.current;
    if (!svgEl) return;

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();

    const rows = analytics.classSummaries;
    if (rows.length === 0) return;

    const width = Math.max(260, scoreChartWidth);
    const rowStep = 34;
    const height = Math.max(224, rows.length * rowStep + 56);
    const maxLabelLen = d3.max(rows, (r) => r.className.length) ?? 8;
    const leftMargin = Math.min(110, Math.max(66, maxLabelLen * 7.2 + 12));
    const margin = { top: 24, right: 44, bottom: 32, left: leftMargin };
    const innerW = Math.max(120, width - margin.left - margin.right);
    const innerH = height - margin.top - margin.bottom;

    const axisColor = isDark ? '#94a3b8' : '#64748b';
    const gridColor = isDark ? '#1e293b' : '#e2e8f0';
    const labelColor = isDark ? '#e2e8f0' : '#0f172a';

    svg.attr('viewBox', `0 0 ${width} ${height}`).attr('width', width).attr('height', height);

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear().domain([0, 100]).range([0, innerW]);
    const y = d3
      .scaleBand<string>()
      .domain(rows.map((r) => r.className))
      .range([0, innerH])
      .padding(0.28);

    // Vertical gridlines
    g.append('g')
      .call(
        d3
          .axisBottom(x)
          .tickValues([0, 25, 50, 75, 100])
          .tickSize(innerH)
          .tickFormat(() => '')
      )
      .call((sel) => sel.select('.domain').remove())
      .call((sel) =>
        sel
          .selectAll('line')
          .attr('stroke', gridColor)
          .attr('stroke-dasharray', '2,3')
      );

    // Track background bars (0..100)
    g.selectAll('rect.score-track')
      .data(rows)
      .enter()
      .append('rect')
      .attr('class', 'score-track')
      .attr('x', 0)
      .attr('y', (d) => y(d.className) ?? 0)
      .attr('width', innerW)
      .attr('height', y.bandwidth())
      .attr('rx', 5)
      .attr('fill', isDark ? '#1e293b' : '#f1f5f9');

    // Score bars
    g.selectAll('rect.score-bar')
      .data(rows)
      .enter()
      .append('rect')
      .attr('class', 'score-bar')
      .attr('x', 0)
      .attr('y', (d) => y(d.className) ?? 0)
      .attr('width', (d) => Math.max(4, x(Math.min(100, Math.max(0, d.averageScore)))))
      .attr('height', y.bandwidth())
      .attr('rx', 5)
      .attr('fill', (d) =>
        d.status === 'problematic'
          ? '#dc2626'
          : d.status === 'warning'
            ? '#d97706'
            : '#16a34a'
      )
      .style('cursor', 'pointer')
      .on('mouseenter', function (_event, d) {
        d3.select(this).attr('opacity', 0.85);
        setHoveredClass(d);
      })
      .on('mouseleave', function () {
        d3.select(this).attr('opacity', 1);
        setHoveredClass(null);
      });

    // KKM reference line
    const kkmVal = Math.min(100, Math.max(0, analytics.overallKkm));
    const kkmX = x(kkmVal);
    g.append('line')
      .attr('x1', kkmX)
      .attr('x2', kkmX)
      .attr('y1', -4)
      .attr('y2', innerH)
      .attr('stroke', isDark ? '#f87171' : '#dc2626')
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '4,3');

    g.append('text')
      .attr('x', kkmX)
      .attr('y', -8)
      .attr('text-anchor', kkmVal > 82 ? 'end' : 'middle')
      .attr('font-size', '10px')
      .attr('font-weight', '600')
      .attr('font-family', 'ui-monospace, SFMono-Regular, Menlo, monospace')
      .attr('fill', isDark ? '#f87171' : '#dc2626')
      .text(`KKM ${kkmVal}`);

    // Score numeric value labels
    g.selectAll('text.score-val')
      .data(rows)
      .enter()
      .append('text')
      .attr('class', 'score-val')
      .attr('x', innerW + 6)
      .attr('y', (d) => (y(d.className) ?? 0) + y.bandwidth() / 2 + 3.5)
      .attr('font-size', '11px')
      .attr('font-weight', '700')
      .attr('font-family', 'ui-monospace, SFMono-Regular, Menlo, monospace')
      .attr('fill', labelColor)
      .text((d) => d.averageScore.toFixed(1));

    // Axes
    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(
        d3
          .axisBottom(x)
          .tickValues([0, 25, 50, 75, 100])
          .tickSizeOuter(0)
      )
      .call((sel) => sel.select('.domain').attr('stroke', gridColor))
      .call((sel) => sel.selectAll('line').attr('stroke', gridColor))
      .call((sel) =>
        sel
          .selectAll('text')
          .attr('fill', axisColor)
          .attr('font-size', '10px')
          .attr('font-family', 'ui-monospace, SFMono-Regular, Menlo, monospace')
      );

    g.append('g')
      .call(d3.axisLeft(y).tickSizeOuter(0))
      .call((sel) => sel.select('.domain').remove())
      .call((sel) => sel.selectAll('line').remove())
      .call((sel) =>
        sel
          .selectAll('text')
          .attr('fill', labelColor)
          .attr('font-size', '11px')
          .attr('font-weight', '600')
      );
  }, [analytics.classSummaries, analytics.overallKkm, scoreChartWidth, isDark]);

  if (packages.length === 0) {
    return null;
  }

  const hasCompletedData = analytics.completedAttempts > 0;
  const dist = analytics.completionDistribution;

  return (
    <section
      aria-label="Exam Summary Dashboard"
      data-testid="exam-summary-dashboard"
      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 sm:p-5 space-y-4 sm:space-y-5"
    >
      {/* Header + Package Scope Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 pb-3 sm:pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <h2 className="text-sm sm:text-base font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Ringkasan & Analitik Ujian
            </h2>
          </div>
          <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Distribusi durasi penyelesaian & rata-rata nilai per kelas.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <label htmlFor="summary-package-filter" className="sr-only">
            Filter paket ujian pada ringkasan analitik
          </label>
          <select
            id="summary-package-filter"
            data-testid="summary-package-filter"
            value={effectiveFilterId}
            onChange={(e) => setFilterPackageId(e.target.value)}
            className="w-full sm:w-64 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 truncate"
          >
            <option value="ALL">Semua Paket Saya ({packages.length})</option>
            {packages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title} ({p.token})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Compact Metric Strip (single hairline divider grid, no card-in-card nesting) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 pb-3 sm:pb-4 border-b border-slate-100 dark:border-slate-800">
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Rata-Rata Nilai
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span
              data-testid="summary-avg-score"
              className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100"
            >
              {analytics.overallAverageScore !== null
                ? analytics.overallAverageScore.toFixed(1)
                : '—'}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
              KKM {analytics.overallKkm}
            </span>
          </div>
        </div>

        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Ketuntasan KKM
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
              {analytics.overallPassRate !== null
                ? `${analytics.overallPassRate}%`
                : '—'}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
              {analytics.completedAttempts} selesai
            </span>
          </div>
        </div>

        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Median Durasi Selesai
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
              {dist.totalCompleted > 0 ? `${dist.medianMinutes}m` : '—'}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
              dari {dist.referenceDurationMinutes}m
            </span>
          </div>
        </div>

        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Sesi Perlu Perhatian
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span
              data-testid="summary-problematic-count"
              className={`text-2xl font-bold font-mono tabular-nums ${
                analytics.problematicSessions.length > 0
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {analytics.problematicSessions.length}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {analytics.problematicSessions.length > 0
                ? 'sesi terdeteksi'
                : 'semua normal'}
            </span>
          </div>
        </div>
      </div>

      {/* Main D3.js Visualizations */}
      {!hasCompletedData ? (
        <div className="py-10 text-center space-y-2">
          <Clock className="h-8 w-8 mx-auto text-slate-300 dark:text-slate-600" />
          <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Belum ada data pengerjaan selesai untuk ditampilkan
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Grafik distribusi waktu penyelesaian dan rata-rata nilai per kelas akan muncul otomatis setelah siswa menyelesaikan paket ujian.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Chart 1: Completion Time Distribution */}
          <div className="min-w-0 space-y-2.5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Distribusi Waktu Penyelesaian
              </h3>
              <div className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                Tercepat {dist.fastestMinutes}m · Rata-rata {dist.averageMinutes}m · Terlama {dist.slowestMinutes}m
              </div>
            </div>

            <div
              ref={timeChartWrapRef}
              className="w-full overflow-x-auto"
              data-testid="d3-completion-time-chart"
            >
              <svg
                ref={timeSvgRef}
                role="img"
                aria-label="Grafik D3 distribusi waktu penyelesaian siswa"
                className="block w-full"
              />
            </div>

            <div className="min-h-[20px] flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
              {hoveredBin ? (
                <span className="font-medium text-slate-800 dark:text-slate-200 font-mono tabular-nums">
                  Rentang {hoveredBin.label}: {hoveredBin.count} siswa ({hoveredBin.percentage}%)
                  {hoveredBin.zone === 'rushed'
                    ? ' — Terlalu cepat (<25% durasi)'
                    : hoveredBin.zone === 'near_limit'
                      ? ' — Mendekati batas waktu'
                      : ' — Tempo normal'}
                </span>
              ) : (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-xs bg-amber-600 inline-block" />
                    Terlalu cepat ({dist.rushedCount})
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-xs bg-indigo-600 inline-block" />
                    Normal
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-xs bg-sky-600 inline-block" />
                    Mendekati batas
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Chart 2: Average Score per Class */}
          <div className="min-w-0 space-y-2.5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Rata-Rata Nilai per Kelas
              </h3>
              <div className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                {analytics.classSummaries.length} kelas · Diurutkan dari nilai terendah
              </div>
            </div>

            <div
              ref={scoreChartWrapRef}
              className="w-full overflow-x-auto"
              data-testid="d3-class-score-chart"
            >
              <svg
                ref={scoreSvgRef}
                role="img"
                aria-label="Grafik D3 rata-rata nilai ujian per kelas"
                className="block w-full"
              />
            </div>

            <div className="min-h-[20px] flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
              {hoveredClass ? (
                <span className="font-medium text-slate-800 dark:text-slate-200 font-mono tabular-nums">
                  {hoveredClass.className}: Rata-rata {hoveredClass.averageScore.toFixed(1)} · Lulus {hoveredClass.passRate}% ({hoveredClass.passCount}/{hoveredClass.completedCount}) · Rentang {hoveredClass.minScore}–{hoveredClass.maxScore}
                  {hoveredClass.avgCompletionMinutes !== null
                    ? ` · Durasi ${hoveredClass.avgCompletionMinutes}m`
                    : ''}
                </span>
              ) : (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-xs bg-red-600 inline-block" />
                    Bermasalah
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-xs bg-amber-600 inline-block" />
                    Di bawah KKM
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-xs bg-green-600 inline-block" />
                    Tuntas KKM
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Problematic Sessions Diagnostic List */}
      {analytics.problematicSessions.length > 0 ? (
        <div
          data-testid="problematic-sessions-list"
          className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2.5"
        >
          <div className="flex items-center gap-2 text-xs font-bold text-rose-700 dark:text-rose-400">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>Deteksi Sesi Ujian Bermasalah</span>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {analytics.problematicSessions.map((item) => (
              <div
                key={item.packageId}
                className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                    <span className="font-bold text-slate-900 dark:text-slate-100">
                      {item.packageTitle}
                    </span>
                    <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
                      ·
                    </span>
                    <span className="text-slate-500 dark:text-slate-400">
                      {item.subject}
                    </span>
                    <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
                      ·
                    </span>
                    <span
                      className={`font-semibold ${
                        item.severity === 'high'
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {item.severity === 'high' ? 'Risiko Tinggi' : 'Perlu Evaluasi'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                    {item.reasons.join(' · ')}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onOpenProctoring(item.packageId)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 whitespace-nowrap shrink-0 self-start sm:self-center"
                >
                  <span>Periksa Sesi</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : hasCompletedData ? (
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>
            Tidak ada sesi bermasalah terdeteksi — nilai rata-rata, ketuntasan KKM, dan distribusi durasi berada dalam batas wajar.
          </span>
          <TrendingUp className="h-3.5 w-3.5 shrink-0 ml-auto hidden sm:block opacity-70" />
        </div>
      ) : null}
    </section>
  );
}
