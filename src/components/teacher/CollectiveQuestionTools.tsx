import React, { useMemo, useState } from 'react';
import {
  CheckSquare,
  Plus,
  Scale,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import type { Question, QuestionType } from '../../types/cbt';
import {
  distributeQuestionWeights,
  type CollectiveQuestionPatch,
  type WeightDistributionMode,
} from '../../utils/cbtLogic';

const TYPE_LABELS: Record<QuestionType, string> = {
  single_choice: 'Pilihan Ganda',
  multiple_choice: 'PG Kompleks',
  matching: 'Menjodohkan',
  true_false: 'Benar / Salah',
  essay: 'Soal Esai',
};

interface WeightSettingsPanelProps {
  questions: Question[];
  selectedIds: string[];
  onApply: (config: WeightDistributionMode, targetIds?: string[]) => void;
  onClose: () => void;
}

export function WeightSettingsPanel({
  questions,
  selectedIds,
  onApply,
  onClose,
}: WeightSettingsPanelProps) {
  const [mode, setMode] = useState<'equal_target' | 'uniform' | 'by_type'>('equal_target');
  const [scope, setScope] = useState<'all' | 'selected'>(
    selectedIds.length > 0 ? 'selected' : 'all'
  );
  const [targetTotal, setTargetTotal] = useState<number>(100);
  const [uniformPoints, setUniformPoints] = useState<number>(10);
  const [weightsByType, setWeightsByType] = useState<Record<QuestionType, number>>({
    single_choice: 2,
    multiple_choice: 4,
    matching: 5,
    true_false: 2,
    essay: 10,
  });

  const activeTargetIds =
    scope === 'selected' && selectedIds.length > 0 ? selectedIds : undefined;

  const config: WeightDistributionMode = useMemo(() => {
    if (mode === 'equal_target') {
      return { mode: 'equal_target', targetTotal };
    }
    if (mode === 'uniform') {
      return { mode: 'uniform', pointsPerQuestion: uniformPoints };
    }
    return { mode: 'by_type', weightsByType };
  }, [mode, targetTotal, uniformPoints, weightsByType]);

  const previewQuestions = useMemo(
    () => distributeQuestionWeights(questions, config, activeTargetIds),
    [activeTargetIds, config, questions]
  );

  const currentTotal = useMemo(
    () => Number(questions.reduce((acc, q) => acc + q.points, 0).toFixed(2)),
    [questions]
  );
  const previewTotal = useMemo(
    () => Number(previewQuestions.reduce((acc, q) => acc + q.points, 0).toFixed(2)),
    [previewQuestions]
  );

  const countByType = useMemo(() => {
    const counts: Record<QuestionType, number> = {
      single_choice: 0,
      multiple_choice: 0,
      matching: 0,
      true_false: 0,
      essay: 0,
    };
    const scoped = activeTargetIds
      ? questions.filter((q) => activeTargetIds.includes(q.id))
      : questions;
    scoped.forEach((q) => {
      counts[q.type] += 1;
    });
    return counts;
  }, [activeTargetIds, questions]);

  const scopedCount = activeTargetIds ? activeTargetIds.length : questions.length;

  return (
    <div
      data-testid="weight-settings-panel"
      className="rounded-xl border border-indigo-200 dark:border-indigo-900 bg-white dark:bg-slate-900 p-5 space-y-4 shadow-xs"
    >
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-start gap-2.5">
          <Scale className="h-5 w-5 text-indigo-600 dark:text-indigo-400 mt-0.5 shrink-0" />
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Pengaturan Bobot Poin Soal
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Atur bobot seluruh soal atau soal terpilih secara otomatis agar total skor ujian presisi.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup pengaturan bobot poin"
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Scope & Mode Selectors */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 p-1">
          {(
            [
              ['equal_target', 'Bagi Rata Target Skor'],
              ['uniform', 'Bobot Seragam'],
              ['by_type', 'Berdasarkan Jenis Soal'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setMode(id)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                mode === id
                  ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {selectedIds.length > 0 && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500 dark:text-slate-400">Cakupan:</span>
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as 'all' | 'selected')}
              aria-label="Cakupan pengaturan bobot"
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100"
            >
              <option value="selected">Soal Terpilih ({selectedIds.length})</option>
              <option value="all">Semua Soal Paket ({questions.length})</option>
            </select>
          </div>
        )}
      </div>

      {/* Mode Controls */}
      {mode === 'equal_target' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-4">
          <div>
            <label
              htmlFor="weight-target-total"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
            >
              Target Total Skor Keseluruhan
            </label>
            <input
              id="weight-target-total"
              type="number"
              min={1}
              max={1000}
              step={1}
              value={targetTotal}
              onChange={(e) => setTargetTotal(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100"
            />
          </div>
          <div className="flex flex-col justify-center text-xs text-slate-600 dark:text-slate-300">
            <div>
              Menerapkan bobot rata ke <strong className="font-mono">{scopedCount}</strong> soal
              ({scopedCount > 0 ? `± ${(Math.max(1, targetTotal || 100) / scopedCount).toFixed(2)}` : '0'} poin/soal).
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Pembulatan otomatis disesuaikan agar jumlah akhir tepat sama dengan target skor.
            </div>
          </div>
        </div>
      )}

      {mode === 'uniform' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-4">
          <div>
            <label
              htmlFor="weight-uniform-points"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
            >
              Bobot Poin per Soal
            </label>
            <input
              id="weight-uniform-points"
              type="number"
              min={0.1}
              max={1000}
              step="any"
              value={uniformPoints}
              onChange={(e) => setUniformPoints(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100"
            />
          </div>
          <div className="flex flex-col justify-center text-xs text-slate-600 dark:text-slate-300">
            Setiap soal dalam cakupan ({scopedCount} soal) akan bernilai{' '}
            <strong className="font-mono">{uniformPoints || 0} poin</strong>.
          </div>
        </div>
      )}

      {mode === 'by_type' && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-4">
          {(
            ['single_choice', 'multiple_choice', 'matching', 'true_false', 'essay'] as QuestionType[]
          ).map((typeKey) => (
            <div key={typeKey}>
              <label
                htmlFor={`weight-type-${typeKey}`}
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                {TYPE_LABELS[typeKey]}{' '}
                <span className="font-mono text-[11px] text-slate-400">
                  ({countByType[typeKey]})
                </span>
              </label>
              <input
                id={`weight-type-${typeKey}`}
                type="number"
                min={0.1}
                max={1000}
                step="any"
                value={weightsByType[typeKey]}
                onChange={(e) =>
                  setWeightsByType((prev) => ({
                    ...prev,
                    [typeKey]: Number(e.target.value),
                  }))
                }
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100"
              />
            </div>
          ))}
        </div>
      )}

      {/* Preview & Apply Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="text-xs text-slate-600 dark:text-slate-300 font-mono tabular-nums">
          Total Saat Ini: <strong>{currentTotal}</strong> poin{' '}
          <span className="mx-1.5 text-slate-400">&rarr;</span>
          Estimasi Baru:{' '}
          <strong className="text-indigo-700 dark:text-indigo-400">
            {previewTotal} poin
          </strong>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 dark:border-slate-700 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={scopedCount === 0}
            onClick={() => onApply(config, activeTargetIds)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            <Scale className="h-3.5 w-3.5" />
            <span>Terapkan Bobot ({scopedCount} Soal)</span>
          </button>
        </div>
      </div>
    </div>
  );
}

interface CollectiveEditRow {
  id: string;
  type: QuestionType;
  prompt: string;
  points: number;
  explanation: string;
  correctOptionId?: string;
  correctOptionIds?: string[];
  correctBoolean?: boolean;
  essayAnswerKey?: string;
  options?: Question['options'];
}

interface CollectiveQuestionEditorProps {
  questions: Question[];
  onSave: (patches: CollectiveQuestionPatch[]) => void;
  onCancel: () => void;
}

export function CollectiveQuestionEditor({
  questions,
  onSave,
  onCancel,
}: CollectiveQuestionEditorProps) {
  const [rows, setRows] = useState<CollectiveEditRow[]>(() =>
    questions.map((q) => ({
      id: q.id,
      type: q.type,
      prompt: q.prompt,
      points: q.points,
      explanation: q.explanation || '',
      correctOptionId: q.correctOptionId,
      correctOptionIds: q.correctOptionIds ? [...q.correctOptionIds] : undefined,
      correctBoolean: q.correctBoolean,
      essayAnswerKey: q.essayAnswerKey || '',
      options: q.options ? q.options.map((o) => ({ ...o })) : undefined,
    }))
  );
  const [expandedOptionRowId, setExpandedOptionRowId] = useState<string | null>(null);

  const totalPreviewPoints = useMemo(
    () => Number(rows.reduce((sum, r) => sum + (Number(r.points) || 0), 0).toFixed(2)),
    [rows]
  );

  const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E'] as const;

  const updateRow = (id: string, patch: Partial<CollectiveEditRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const handleAddOptionToRow = (row: CollectiveEditRow) => {
    const existing = row.options || [];
    if (existing.length >= OPTION_LETTERS.length) return;
    const nextLetter = OPTION_LETTERS[existing.length];
    updateRow(row.id, {
      options: [...existing, { id: nextLetter, text: '' }],
    });
  };

  const handleRemoveOptionFromRow = (row: CollectiveEditRow, removeIdx: number) => {
    const existing = row.options || [];
    if (existing.length <= 2) return;
    const oldToNew = new Map<string, string>();
    const nextOptions: NonNullable<Question['options']> = [];
    existing.forEach((opt, idx) => {
      if (idx === removeIdx) return;
      const nextId = OPTION_LETTERS[nextOptions.length];
      oldToNew.set(opt.id, nextId);
      nextOptions.push({ id: nextId, text: opt.text });
    });

    const nextCorrectSingle = row.correctOptionId
      ? oldToNew.get(row.correctOptionId) || nextOptions[0]?.id || 'A'
      : undefined;
    const nextCorrectMulti = row.correctOptionIds
      ? (() => {
          const mapped = row.correctOptionIds
            .map((id) => oldToNew.get(id))
            .filter((id): id is string => Boolean(id));
          return mapped.length > 0 ? mapped : [nextOptions[0]?.id || 'A'];
        })()
      : undefined;

    updateRow(row.id, {
      options: nextOptions,
      correctOptionId: nextCorrectSingle,
      correctOptionIds: nextCorrectMulti,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const patches: CollectiveQuestionPatch[] = rows.map((r) => {
      const cleanedOptions = r.options
        ? r.options
            .map((o, idx) => ({
              id: OPTION_LETTERS[idx] || o.id,
              text: o.text.trim(),
            }))
            .filter((o) => o.text.length > 0)
        : undefined;

      const finalOptions =
        cleanedOptions && cleanedOptions.length >= 2
          ? cleanedOptions.map((o, idx) => ({
              id: OPTION_LETTERS[idx] || o.id,
              text: o.text,
            }))
          : r.options;

      const validIds = new Set((finalOptions || []).map((o) => o.id));
      const safeSingleKey =
        r.type === 'single_choice' && finalOptions
          ? validIds.has(r.correctOptionId || '')
            ? r.correctOptionId
            : finalOptions[0]?.id
          : r.correctOptionId;
      const safeMultiKeys =
        r.type === 'multiple_choice' && finalOptions
          ? (() => {
              const filtered = (r.correctOptionIds || []).filter((id) =>
                validIds.has(id)
              );
              return filtered.length > 0
                ? filtered
                : [finalOptions[0]?.id || 'A'];
            })()
          : r.correctOptionIds;

      return {
        id: r.id,
        prompt: r.prompt,
        points: Math.max(0.1, Number(r.points) || 1),
        explanation: r.explanation,
        correctOptionId: safeSingleKey,
        correctOptionIds: safeMultiKeys,
        correctBoolean: r.correctBoolean,
        essayAnswerKey: r.type === 'essay' ? r.essayAnswerKey : undefined,
        options: finalOptions,
      };
    });
    onSave(patches);
  };

  return (
    <form
      onSubmit={handleSubmit}
      data-testid="collective-editor-panel"
      className="rounded-xl border border-indigo-200 dark:border-indigo-900 bg-white dark:bg-slate-900 p-5 space-y-4 shadow-xs"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-start gap-2.5">
          <CheckSquare className="h-5 w-5 text-indigo-600 dark:text-indigo-400 mt-0.5 shrink-0" />
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Edit Soal Secara Kolektif ({rows.length} Butir Soal)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Ubah teks pertanyaan, bobot poin, kunci jawaban, opsi, dan pembahasan banyak soal sekaligus lalu simpan dalam satu klik.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300">
            Total Bobot:{' '}
            <strong className="text-indigo-700 dark:text-indigo-400">
              {totalPreviewPoints} poin
            </strong>
          </span>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Tutup edit kolektif"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
        {rows.map((row, idx) => (
          <div
            key={row.id}
            data-testid={`collective-row-${idx}`}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 p-4 space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                  No. {idx + 1}
                </span>
                <span className="mx-1.5">·</span>
                <span className="font-semibold text-indigo-700 dark:text-indigo-400">
                  {TYPE_LABELS[row.type]}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* Inline Answer Key Selector */}
                {row.type === 'single_choice' && row.options && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      Kunci:
                    </span>
                    <select
                      aria-label={`Kunci jawaban soal ${idx + 1}`}
                      value={row.correctOptionId || 'A'}
                      onChange={(e) =>
                        updateRow(row.id, { correctOptionId: e.target.value })
                      }
                      className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400"
                    >
                      {row.options.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.id}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {row.type === 'multiple_choice' && row.options && (
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 mr-1">
                      Kunci:
                    </span>
                    {row.options.map((opt) => {
                      const active = (row.correctOptionIds || []).includes(opt.id);
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            const curr = row.correctOptionIds || [];
                            const next = active
                              ? curr.filter((id) => id !== opt.id)
                              : [...curr, opt.id];
                            if (next.length > 0) {
                              updateRow(row.id, { correctOptionIds: next });
                            }
                          }}
                          className={`h-6 w-6 rounded border font-mono text-[11px] font-bold ${
                            active
                              ? 'border-emerald-600 bg-emerald-600 text-white'
                              : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {opt.id}
                        </button>
                      );
                    })}
                  </div>
                )}

                {row.type === 'true_false' && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      Kunci:
                    </span>
                    <select
                      aria-label={`Kunci benar salah soal ${idx + 1}`}
                      value={row.correctBoolean ? 'true' : 'false'}
                      onChange={(e) =>
                        updateRow(row.id, { correctBoolean: e.target.value === 'true' })
                      }
                      className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400"
                    >
                      <option value="true">BENAR</option>
                      <option value="false">SALAH</option>
                    </select>
                  </div>
                )}

                {/* Inline Points Input */}
                <div className="flex items-center gap-1.5">
                  <label
                    htmlFor={`col-pts-${row.id}`}
                    className="text-[11px] font-semibold text-slate-600 dark:text-slate-300"
                  >
                    Bobot:
                  </label>
                  <input
                    id={`col-pts-${row.id}`}
                    type="number"
                    min={0.1}
                    max={1000}
                    step="any"
                    value={row.points}
                    onChange={(e) =>
                      updateRow(row.id, { points: Number(e.target.value) })
                    }
                    className="w-20 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs font-mono text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>
            </div>

            {/* Prompt & Explanation */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor={`col-prompt-${row.id}`}
                  className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1"
                >
                  Pertanyaan
                </label>
                <textarea
                  id={`col-prompt-${row.id}`}
                  rows={2}
                  value={row.prompt}
                  onChange={(e) => updateRow(row.id, { prompt: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-indigo-600 focus:outline-none"
                />
              </div>
              <div>
                <label
                  htmlFor={`col-expl-${row.id}`}
                  className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1"
                >
                  Pembahasan
                </label>
                <textarea
                  id={`col-expl-${row.id}`}
                  rows={2}
                  value={row.explanation}
                  onChange={(e) =>
                    updateRow(row.id, { explanation: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-indigo-600 focus:outline-none"
                />
              </div>
            </div>

            {row.type === 'essay' && (
              <div>
                <label
                  htmlFor={`col-essay-key-${row.id}`}
                  className="block text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 mb-1"
                >
                  Kunci Jawaban Esai (Acuan Makna Koreksi Otomatis)
                </label>
                <textarea
                  id={`col-essay-key-${row.id}`}
                  rows={2}
                  value={row.essayAnswerKey || ''}
                  onChange={(e) =>
                    updateRow(row.id, { essayAnswerKey: e.target.value })
                  }
                  className="w-full rounded-lg border border-emerald-300 dark:border-emerald-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-emerald-600 focus:outline-none"
                />
              </div>
            )}

            {/* Expandable Inline Options Editor */}
            {row.options && row.options.length > 0 && (
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedOptionRowId((prev) =>
                        prev === row.id ? null : row.id
                      )
                    }
                    className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-400 hover:underline"
                  >
                    {expandedOptionRowId === row.id
                      ? 'Sembunyikan Opsi Jawaban'
                      : `Edit Opsi Jawaban (${row.options.length} opsi: A–${row.options[row.options.length - 1]?.id || 'D'})`}
                  </button>

                  {expandedOptionRowId === row.id &&
                    row.options.length < OPTION_LETTERS.length && (
                      <button
                        type="button"
                        onClick={() => handleAddOptionToRow(row)}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700 dark:text-indigo-400 hover:underline"
                      >
                        <Plus className="h-3 w-3" />
                        <span>Tambah Opsi {OPTION_LETTERS[row.options.length]}</span>
                      </button>
                    )}
                </div>

                {expandedOptionRowId === row.id && (
                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {row.options.map((opt, optIdx) => (
                      <div key={opt.id} className="flex items-center gap-1.5">
                        <span className="font-mono text-xs font-bold text-slate-500 w-5">
                          {opt.id}.
                        </span>
                        <input
                          type="text"
                          value={opt.text}
                          placeholder={`Teks pilihan ${opt.id}`}
                          onChange={(e) => {
                            const nextOpts = (row.options || []).map((o, i) =>
                              i === optIdx ? { ...o, text: e.target.value } : o
                            );
                            updateRow(row.id, { options: nextOpts });
                          }}
                          className="flex-1 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                        />
                        {row.options && row.options.length > 2 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveOptionFromRow(row, optIdx)}
                            aria-label={`Hapus opsi ${opt.id} soal ${idx + 1}`}
                            className="rounded border border-rose-200 dark:border-rose-800 p-1 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800 pt-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          Batal
        </button>
        <button
          type="submit"
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
        >
          <Save className="h-3.5 w-3.5" />
          <span>Simpan Semua Perubahan ({rows.length} Soal)</span>
        </button>
      </div>
    </form>
  );
}
