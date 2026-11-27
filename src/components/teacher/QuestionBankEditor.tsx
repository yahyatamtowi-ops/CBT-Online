import React, { useEffect, useState } from 'react';
import {
  CheckSquare,
  Copy,
  Download,
  Edit3,
  FileDown,
  FolderInput,
  Image as ImageIcon,
  Plus,
  Scale,
  Trash2,
  Upload,
} from 'lucide-react';
import { useCBT } from '../../context/CBTContext';
import type {
  MatchingPair,
  Question,
  QuestionOption,
  QuestionType,
  TeacherAccount,
} from '../../types/cbt';
import {
  generateQuestionsCSVTemplate,
  parseQuestionsBulkText,
  type CollectiveQuestionPatch,
  type WeightDistributionMode,
} from '../../utils/cbtLogic';
import {
  CollectiveQuestionEditor,
  WeightSettingsPanel,
} from './CollectiveQuestionTools';

const MATH_SYMBOLS = [
  '²', '³', '⁻¹', '√', 'π', 'θ', 'Δ', 'α', 'β', 'μ', 'Ω', '°', '±', '×', '÷', '≤', '≥', '≠', '→', '∑',
];

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  single_choice: 'Pilihan Ganda',
  multiple_choice: 'PG Kompleks',
  matching: 'Menjodohkan',
  true_false: 'Benar / Salah',
};

export function QuestionBankEditor({
  teacher,
  selectedPackageId,
  onSelectPackage,
}: {
  teacher: TeacherAccount;
  selectedPackageId: string;
  onSelectPackage: (id: string) => void;
}) {
  const {
    db,
    upsertQuestion,
    deleteQuestion,
    bulkAddQuestions,
    bulkUpdateQuestions,
    applyQuestionWeightDistribution,
    bulkDeleteQuestions,
    copyOrMoveQuestionsToPackage,
  } = useCBT();
  const myPackages = db.packages.filter((p) => p.teacherId === teacher.id);
  const currentPkg =
    myPackages.find((p) => p.id === selectedPackageId) || myPackages[0];
  const pkgQuestions = currentPkg
    ? db.questions.filter((q) => q.packageId === currentPkg.id)
    : [];

  const [showEditor, setShowEditor] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [showWeightPanel, setShowWeightPanel] = useState(false);
  const [showCollectiveEditor, setShowCollectiveEditor] = useState(false);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [transferTargetPkgId, setTransferTargetPkgId] = useState<string>('');
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Reset selections when switching packages
  useEffect(() => {
    setSelectedQuestionIds([]);
    setConfirmBulkDelete(false);
    setShowCollectiveEditor(false);
    setShowWeightPanel(false);
  }, [currentPkg?.id]);

  const [qType, setQType] = useState<QuestionType>('single_choice');
  const [prompt, setPrompt] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [points, setPoints] = useState(10);
  const [explanation, setExplanation] = useState('');
  const [options, setOptions] = useState<QuestionOption[]>([
    { id: 'A', text: '' },
    { id: 'B', text: '' },
    { id: 'C', text: '' },
    { id: 'D', text: '' },
  ]);
  const [correctOptionId, setCorrectOptionId] = useState('A');
  const [correctOptionIds, setCorrectOptionIds] = useState<string[]>(['A']);
  const [matchingPairs, setMatchingPairs] = useState<MatchingPair[]>([
    { id: 'p-1', left: '', right: '' },
    { id: 'p-2', left: '', right: '' },
    { id: 'p-3', left: '', right: '' },
  ]);
  const [correctBoolean, setCorrectBoolean] = useState(true);

  const [bulkText, setBulkText] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const openNewQuestion = () => {
    setEditingId(null);
    setQType('single_choice');
    setPrompt('');
    setImageUrl('');
    setPoints(10);
    setExplanation('');
    setOptions([
      { id: 'A', text: '' },
      { id: 'B', text: '' },
      { id: 'C', text: '' },
      { id: 'D', text: '' },
    ]);
    setCorrectOptionId('A');
    setCorrectOptionIds(['A']);
    setMatchingPairs([
      { id: 'p-1', left: '', right: '' },
      { id: 'p-2', left: '', right: '' },
      { id: 'p-3', left: '', right: '' },
    ]);
    setCorrectBoolean(true);
    setShowEditor(true);
    setShowBulkImport(false);
    setShowWeightPanel(false);
    setShowCollectiveEditor(false);
    setFeedback(null);
  };

  const openEditQuestion = (q: Question) => {
    setEditingId(q.id);
    setQType(q.type);
    setPrompt(q.prompt);
    setImageUrl(q.imageUrl || '');
    setPoints(q.points);
    setExplanation(q.explanation || '');
    setOptions(
      q.options && q.options.length > 0
        ? q.options
        : [
            { id: 'A', text: '' },
            { id: 'B', text: '' },
            { id: 'C', text: '' },
            { id: 'D', text: '' },
          ]
    );
    setCorrectOptionId(q.correctOptionId || 'A');
    setCorrectOptionIds(q.correctOptionIds || ['A']);
    setMatchingPairs(
      q.matchingPairs && q.matchingPairs.length > 0
        ? q.matchingPairs
        : [
            { id: 'p-1', left: '', right: '' },
            { id: 'p-2', left: '', right: '' },
          ]
    );
    setCorrectBoolean(q.correctBoolean ?? true);
    setShowEditor(true);
    setShowBulkImport(false);
    setShowWeightPanel(false);
    setShowCollectiveEditor(false);
    setFeedback(null);
  };

  const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E'] as const;

  const handleAddOption = () => {
    if (options.length >= OPTION_LETTERS.length) return;
    const nextLetter = OPTION_LETTERS[options.length];
    setOptions((prev) => [...prev, { id: nextLetter, text: '' }]);
  };

  const handleRemoveOption = (removeIdx: number) => {
    if (options.length <= 2) return;
    const oldIdToNewId = new Map<string, string>();
    const nextOptions: QuestionOption[] = [];
    options.forEach((opt, idx) => {
      if (idx === removeIdx) return;
      const nextId = OPTION_LETTERS[nextOptions.length];
      oldIdToNewId.set(opt.id, nextId);
      nextOptions.push({ id: nextId, text: opt.text });
    });

    setOptions(nextOptions);
    const mappedSingle = oldIdToNewId.get(correctOptionId);
    setCorrectOptionId(mappedSingle || nextOptions[0]?.id || 'A');
    setCorrectOptionIds((prev) => {
      const mapped = prev
        .map((id) => oldIdToNewId.get(id))
        .filter((id): id is string => Boolean(id));
      return mapped.length > 0 ? mapped : [nextOptions[0]?.id || 'A'];
    });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setImageUrl(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPkg) return;
    if (!prompt.trim()) {
      setFeedback({ type: 'err', text: 'Teks pertanyaan tidak boleh kosong.' });
      return;
    }

    const cleanedOptions = options.map((o, idx) => ({
      id: OPTION_LETTERS[idx] || o.id,
      text: o.text.trim(),
    }));
    const validOptionIds = new Set<string>(cleanedOptions.map((o) => o.id));
    const resolvedCorrectSingle = validOptionIds.has(correctOptionId)
      ? correctOptionId
      : cleanedOptions[0]?.id || 'A';
    const resolvedCorrectMulti = correctOptionIds.filter((id) =>
      validOptionIds.has(id)
    );

    if (qType === 'single_choice' || qType === 'multiple_choice') {
      if (cleanedOptions.length < 2 || cleanedOptions.some((o) => !o.text)) {
        setFeedback({ type: 'err', text: 'Semua teks opsi jawaban harus diisi.' });
        return;
      }
      if (qType === 'multiple_choice' && resolvedCorrectMulti.length === 0) {
        setFeedback({ type: 'err', text: 'Pilih minimal 1 kunci jawaban benar.' });
        return;
      }
    }

    const cleanedPairs = matchingPairs.map((p) => ({
      ...p,
      left: p.left.trim(),
      right: p.right.trim(),
    }));
    if (qType === 'matching') {
      if (cleanedPairs.length < 2 || cleanedPairs.some((p) => !p.left || !p.right)) {
        setFeedback({ type: 'err', text: 'Minimal 2 pasangan menjodohkan lengkap wajib diisi.' });
        return;
      }
    }

    const numericPoints = Number(points);
    const safePoints =
      Number.isFinite(numericPoints) && numericPoints > 0
        ? Math.max(0.1, Number(numericPoints.toFixed(2)))
        : 10;

    upsertQuestion({
      id: editingId || undefined,
      packageId: currentPkg.id,
      type: qType,
      prompt: prompt.trim(),
      imageUrl: imageUrl.trim() || undefined,
      options: qType === 'single_choice' || qType === 'multiple_choice' ? cleanedOptions : undefined,
      correctOptionId: qType === 'single_choice' ? resolvedCorrectSingle : undefined,
      correctOptionIds: qType === 'multiple_choice' ? resolvedCorrectMulti : undefined,
      matchingPairs: qType === 'matching' ? cleanedPairs : undefined,
      correctBoolean: qType === 'true_false' ? correctBoolean : undefined,
      points: safePoints,
      explanation: explanation.trim() || 'Sesuai kunci jawaban paket soal.',
    });

    if (selectedPackageId !== currentPkg.id) {
      onSelectPackage(currentPkg.id);
    }
    setShowEditor(false);
    setFeedback({
      type: 'ok',
      text: editingId ? 'Butir soal berhasil diperbarui.' : 'Butir soal baru ditambahkan ke bank soal.',
    });
  };

  const handleDownloadQuestionTemplate = () => {
    const template = generateQuestionsCSVTemplate();
    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'format-import-soal.csv';
    a.click();
    URL.revokeObjectURL(url);
    setFeedback({
      type: 'ok',
      text: 'Format template import soal (.csv) berhasil diunduh.',
    });
  };

  const handleBulkImportSubmit = () => {
    if (!currentPkg) return;
    if (!bulkText.trim()) {
      setFeedback({
        type: 'err',
        text: 'Tempel daftar soal atau unggah file CSV/TXT sesuai format template terlebih dahulu.',
      });
      return;
    }
    const parsed = parseQuestionsBulkText(bulkText, currentPkg.id);
    if (parsed.questions.length === 0) {
      setFeedback({
        type: 'err',
        text: parsed.errors[0] || 'Tidak ditemukan soal valid untuk diimpor.',
      });
      return;
    }
    bulkAddQuestions(parsed.questions);
    if (selectedPackageId !== currentPkg.id) {
      onSelectPackage(currentPkg.id);
    }
    setBulkText('');
    setShowBulkImport(false);
    setFeedback({
      type: 'ok',
      text: `Berhasil mengimpor ${parsed.questions.length} butir soal ke paket "${currentPkg.title}"${
        parsed.errors.length > 0 ? ` (${parsed.errors.length} baris dilewati)` : ''
      }.`,
    });
  };

  const handleBulkFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setBulkText(reader.result);
    };
    reader.readAsText(file);
  };

  const handleExportQuestions = () => {
    if (!currentPkg) return;
    const blob = new Blob([JSON.stringify(pkgQuestions, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bank-soal-${currentPkg.token.toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setFeedback({ type: 'ok', text: `Bank soal (${pkgQuestions.length} butir) berhasil diekspor.` });
  };

  const validSelectedIds = selectedQuestionIds.filter((id) =>
    pkgQuestions.some((q) => q.id === id)
  );
  const allSelected =
    pkgQuestions.length > 0 && validSelectedIds.length === pkgQuestions.length;

  const toggleSelectQuestion = (id: string) => {
    setSelectedQuestionIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
    setConfirmBulkDelete(false);
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedQuestionIds([]);
    } else {
      setSelectedQuestionIds(pkgQuestions.map((q) => q.id));
    }
    setConfirmBulkDelete(false);
  };

  const handleApplyWeightConfig = (
    config: WeightDistributionMode,
    targetIds?: string[]
  ) => {
    if (!currentPkg) return;
    const count = applyQuestionWeightDistribution(currentPkg.id, config, targetIds);
    setShowWeightPanel(false);
    setFeedback({
      type: 'ok',
      text: `Bobot poin berhasil diterapkan pada ${count} butir soal.`,
    });
  };

  const handleSaveCollectiveEdits = (patches: CollectiveQuestionPatch[]) => {
    const updated = bulkUpdateQuestions(patches);
    setShowCollectiveEditor(false);
    setFeedback({
      type: 'ok',
      text: `Berhasil menyimpan perubahan kolektif untuk ${updated} butir soal.`,
    });
  };

  const handleBulkDeleteSelected = () => {
    if (validSelectedIds.length === 0) return;
    const removed = bulkDeleteQuestions(validSelectedIds);
    setSelectedQuestionIds([]);
    setConfirmBulkDelete(false);
    setFeedback({
      type: 'ok',
      text: `${removed} butir soal terpilih berhasil dihapus.`,
    });
  };

  const handleTransferSelected = (mode: 'copy' | 'move') => {
    if (validSelectedIds.length === 0 || !transferTargetPkgId) return;
    const target = myPackages.find((p) => p.id === transferTargetPkgId);
    const count = copyOrMoveQuestionsToPackage(
      validSelectedIds,
      transferTargetPkgId,
      mode
    );
    setSelectedQuestionIds([]);
    setFeedback({
      type: 'ok',
      text: `Berhasil ${mode === 'move' ? 'memindahkan' : 'menyalin'} ${count} soal ke paket "${target?.title || ''}".`,
    });
  };

  const otherPackages = myPackages.filter((p) => p.id !== currentPkg?.id);
  const collectiveTargets =
    validSelectedIds.length > 0
      ? pkgQuestions.filter((q) => validSelectedIds.includes(q.id))
      : pkgQuestions;

  if (!currentPkg) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-sm text-slate-600 dark:text-slate-400">
        Buat paket ujian terlebih dahulu pada menu Paket Ujian Saya untuk mengelola bank soal.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Bank Soal & Editor Interaktif
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Kelola soal Pilihan Ganda, PG Kompleks, Menjodohkan, dan Benar/Salah lengkap dengan gambar & pembahasan.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={currentPkg.id}
            onChange={(e) => onSelectPackage(e.target.value)}
            aria-label="Pilih paket ujian"
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 max-w-xs"
          >
            {myPackages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title} ({p.token})
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleDownloadQuestionTemplate}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 whitespace-nowrap"
          >
            <FileDown className="h-3.5 w-3.5" />
            <span>Download Format</span>
          </button>

          <button
            type="button"
            disabled={pkgQuestions.length === 0}
            onClick={() => {
              setShowWeightPanel((v) => !v);
              setShowCollectiveEditor(false);
              setShowEditor(false);
              setShowBulkImport(false);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/70 dark:bg-indigo-950/40 px-3 py-2 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-950/70 disabled:opacity-50 whitespace-nowrap"
          >
            <Scale className="h-3.5 w-3.5" />
            <span>Bobot Poin</span>
          </button>

          <button
            type="button"
            disabled={pkgQuestions.length === 0}
            onClick={() => {
              setShowCollectiveEditor((v) => !v);
              setShowWeightPanel(false);
              setShowEditor(false);
              setShowBulkImport(false);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/70 dark:bg-indigo-950/40 px-3 py-2 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-950/70 disabled:opacity-50 whitespace-nowrap"
          >
            <CheckSquare className="h-3.5 w-3.5" />
            <span>
              Edit Kolektif{validSelectedIds.length > 0 ? ` (${validSelectedIds.length})` : ''}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setShowBulkImport((v) => !v);
              setShowEditor(false);
              setShowWeightPanel(false);
              setShowCollectiveEditor(false);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 whitespace-nowrap"
          >
            <Upload className="h-3.5 w-3.5" />
            <span>Import Massal</span>
          </button>

          <button
            type="button"
            onClick={handleExportQuestions}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export Soal</span>
          </button>

          <button
            type="button"
            onClick={openNewQuestion}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-700 whitespace-nowrap"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Tambah Soal</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div
          role="status"
          className={`rounded-lg border px-4 py-3 text-xs font-medium ${
            feedback.type === 'ok'
              ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200'
              : 'border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-200'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Weight Settings Panel (Pengaturan Bobot Poin Soal) */}
      {showWeightPanel && pkgQuestions.length > 0 && (
        <WeightSettingsPanel
          questions={pkgQuestions}
          selectedIds={validSelectedIds}
          onApply={handleApplyWeightConfig}
          onClose={() => setShowWeightPanel(false)}
        />
      )}

      {/* Collective Question Editor (Edit Soal Secara Kolektif) */}
      {showCollectiveEditor && collectiveTargets.length > 0 && (
        <CollectiveQuestionEditor
          key={collectiveTargets.map((q) => q.id).join(',')}
          questions={collectiveTargets}
          onSave={handleSaveCollectiveEdits}
          onCancel={() => setShowCollectiveEditor(false)}
        />
      )}

      {/* Bulk Import Drawer */}
      {showBulkImport && (
        <div className="rounded-xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/40 dark:bg-indigo-950/20 p-5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Import Soal Massal (Teks / CSV)
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Opsi A–D maupun A–E terdeteksi otomatis sesuai input. Format tabel (<code className="font-mono">|</code>, <code className="font-mono">;</code>, <code className="font-mono">,</code>, atau Tab):{' '}
                <code className="font-mono">PG | Pertanyaan | A | B | C | D | E | Kunci | Pembahasan</code> (kosongkan E jika hanya A–D) ·{' '}
                <code className="font-mono">PGK | ... | A,E | ...</code> · <code className="font-mono">BS | Pernyataan | Benar/Salah | Pembahasan</code> · atau tempel langsung format bernomor (<code className="font-mono">1. Soal ... A. ... E. ... Kunci: E</code>).
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 self-start">
              <button
                type="button"
                onClick={handleDownloadQuestionTemplate}
                className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 whitespace-nowrap"
              >
                <FileDown className="h-3.5 w-3.5" />
                <span>Download Format (.csv)</span>
              </button>
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 whitespace-nowrap">
                <Upload className="h-3.5 w-3.5" />
                <span>Unggah CSV/TXT</span>
                <input
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleBulkFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>
          <textarea
            rows={6}
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            aria-label="Format soal massal"
            placeholder={'PG | Pertanyaan 5 opsi (A–E)? | Opsi A | Opsi B | Opsi C | Opsi D | Opsi E | E | Pembahasan singkat\nPG | Pertanyaan 4 opsi (A–D)? | Opsi A | Opsi B | Opsi C | Opsi D | B | Pembahasan singkat\nBS | Pernyataan benar atau salah. | Benar | Alasan singkat'}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 font-mono text-xs text-slate-800 dark:text-slate-100 focus:border-indigo-600 focus:outline-none"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowBulkImport(false)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200"
            >
              Tutup
            </button>
            <button
              type="button"
              onClick={handleBulkImportSubmit}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
            >
              Impor ke Bank Soal
            </button>
          </div>
        </div>
      )}

      {/* Interactive Question Editor */}
      {showEditor && (
        <form
          onSubmit={handleSaveQuestion}
          className="rounded-xl border border-indigo-200 dark:border-indigo-900 bg-white dark:bg-slate-900 p-6 space-y-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              {editingId ? 'Edit Butir Soal' : 'Buat Butir Soal Baru'}
            </h2>
            <div className="flex flex-wrap gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 p-1">
              {(
                [
                  'single_choice',
                  'multiple_choice',
                  'matching',
                  'true_false',
                ] as QuestionType[]
              ).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setQType(t)}
                  className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                    qType === t
                      ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  {QUESTION_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          {/* Prompt + Math Symbol Toolbar */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="q-prompt" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Pertanyaan / Pernyataan Soal
              </label>
              <div className="flex flex-wrap items-center gap-1">
                <span className="text-[11px] text-slate-400 mr-1">Simbol Sains:</span>
                {MATH_SYMBOLS.map((sym) => (
                  <button
                    key={sym}
                    type="button"
                    onClick={() => setPrompt((prev) => prev + sym)}
                    className="rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-1.5 py-0.5 text-xs font-mono text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 hover:text-indigo-700 dark:hover:text-indigo-300"
                    title={`Sisipkan ${sym}`}
                  >
                    {sym}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              id="q-prompt"
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Tuliskan teks pertanyaan secara jelas..."
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-sm text-slate-900 dark:text-slate-100 focus:border-indigo-600 focus:outline-none"
            />
          </div>

          {/* Image Attachment + Points */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="sm:col-span-3 space-y-1.5">
              <label htmlFor="q-img" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Sisipan Gambar (Opsional — URL atau Unggah Base64)
              </label>
              <div className="flex gap-2">
                <input
                  id="q-img"
                  type="text"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://... atau unggah berkas gambar"
                  className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100 focus:border-indigo-600 focus:outline-none"
                />
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 whitespace-nowrap">
                  <ImageIcon className="h-3.5 w-3.5" />
                  <span>Unggah</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
            <div>
              <label htmlFor="q-points" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Bobot Poin
              </label>
              <input
                id="q-points"
                type="number"
                min={0.1}
                max={1000}
                step="any"
                value={points}
                onChange={(e) => setPoints(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100 focus:border-indigo-600 focus:outline-none"
              />
            </div>
          </div>

          {/* Answer Configuration per Question Type */}
          {(qType === 'single_choice' || qType === 'multiple_choice') && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Opsi Jawaban ({options.length} pilihan: A–{options[options.length - 1]?.id || 'D'} · {qType === 'single_choice' ? 'Pilih 1 kunci benar' : 'Centang semua kunci benar'})
                </p>
                {options.length < OPTION_LETTERS.length && (
                  <button
                    type="button"
                    onClick={handleAddOption}
                    className="text-xs font-semibold text-indigo-700 dark:text-indigo-400 hover:underline"
                  >
                    + Tambah Opsi {OPTION_LETTERS[options.length]}
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {options.map((opt, idx) => {
                  const isCorrect =
                    qType === 'single_choice'
                      ? correctOptionId === opt.id
                      : correctOptionIds.includes(opt.id);
                  return (
                    <div key={opt.id} className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          if (qType === 'single_choice') {
                            setCorrectOptionId(opt.id);
                          } else {
                            setCorrectOptionIds((prev) =>
                              prev.includes(opt.id)
                                ? prev.filter((id) => id !== opt.id)
                                : [...prev, opt.id]
                            );
                          }
                        }}
                        aria-label={`Tandai opsi ${opt.id} sebagai kunci jawaban`}
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border font-mono text-xs font-bold transition-colors ${
                          isCorrect
                            ? 'border-emerald-600 bg-emerald-600 text-white'
                            : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                        }`}
                      >
                        {opt.id}
                      </button>
                      <input
                        type="text"
                        value={opt.text}
                        onChange={(e) => {
                          const next = [...options];
                          next[idx] = { ...opt, text: e.target.value };
                          setOptions(next);
                        }}
                        placeholder={`Teks pilihan ${opt.id}`}
                        className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-indigo-600 focus:outline-none"
                      />
                      {options.length > 2 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveOption(idx)}
                          aria-label={`Hapus opsi ${opt.id}`}
                          className="rounded-lg border border-rose-200 dark:border-rose-800 p-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 shrink-0"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {qType === 'matching' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Pasangan Menjodohkan (Premis Kiri ↔ Jawaban Kanan)
                </p>
                <button
                  type="button"
                  onClick={() =>
                    setMatchingPairs((prev) => [
                      ...prev,
                      { id: `p-${Date.now()}`, left: '', right: '' },
                    ])
                  }
                  className="text-xs font-semibold text-indigo-700 dark:text-indigo-400 hover:underline"
                >
                  + Tambah Pasangan
                </button>
              </div>
              {matchingPairs.map((pair, idx) => (
                <div key={pair.id} className="grid grid-cols-1 sm:grid-cols-11 gap-2 items-center">
                  <input
                    type="text"
                    value={pair.left}
                    onChange={(e) => {
                      const next = [...matchingPairs];
                      next[idx] = { ...pair, left: e.target.value };
                      setMatchingPairs(next);
                    }}
                    placeholder={`Premis ${idx + 1}`}
                    className="sm:col-span-5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
                  />
                  <span className="text-center text-xs text-slate-400">↔</span>
                  <input
                    type="text"
                    value={pair.right}
                    onChange={(e) => {
                      const next = [...matchingPairs];
                      next[idx] = { ...pair, right: e.target.value };
                      setMatchingPairs(next);
                    }}
                    placeholder={`Pasangan benar ${idx + 1}`}
                    className="sm:col-span-4 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setMatchingPairs((prev) => prev.filter((p) => p.id !== pair.id))
                    }
                    disabled={matchingPairs.length <= 2}
                    aria-label="Hapus pasangan"
                    className="rounded-lg border border-rose-200 dark:border-rose-800 p-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 disabled:opacity-40 justify-self-end"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {qType === 'true_false' && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Kunci Jawaban Benar / Salah</p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setCorrectBoolean(true)}
                  className={`rounded-lg border px-5 py-2 text-xs font-semibold ${
                    correctBoolean
                      ? 'border-emerald-600 bg-emerald-600 text-white'
                      : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  Benar
                </button>
                <button
                  type="button"
                  onClick={() => setCorrectBoolean(false)}
                  className={`rounded-lg border px-5 py-2 text-xs font-semibold ${
                    !correctBoolean
                      ? 'border-rose-600 bg-rose-600 text-white'
                      : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  Salah
                </button>
              </div>
            </div>
          )}

          {/* Explanation */}
          <div>
            <label htmlFor="q-expl" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Pembahasan Soal (Untuk Mode Latihan & Tinjauan Nilai)
            </label>
            <textarea
              id="q-expl"
              rows={2}
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder="Tuliskan langkah penyelesaian atau alasan kunci jawaban..."
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-xs text-slate-900 dark:text-slate-100 focus:border-indigo-600 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowEditor(false)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Batal
            </button>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
            >
              Simpan Butir Soal
            </button>
          </div>
        </form>
      )}

      {/* Question List + Collective Selection Bar */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex flex-wrap items-center gap-3">
            {pkgQuestions.length > 0 && (
              <label className="inline-flex cursor-pointer items-center gap-2 font-semibold text-slate-700 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  aria-label="Pilih semua soal dalam paket"
                  className="h-4 w-4 rounded border-slate-400 text-indigo-600"
                />
                <span>Pilih Semua</span>
              </label>
            )}
            <span>
              Menampilkan <strong className="text-slate-900 dark:text-slate-100 font-mono">{pkgQuestions.length}</strong> butir soal pada paket{' '}
              <strong className="text-slate-900 dark:text-slate-100">{currentPkg.title}</strong>
            </span>
          </div>
          <span className="font-mono tabular-nums" data-testid="total-weight-summary">
            Total Bobot: {Number(pkgQuestions.reduce((acc, q) => acc + q.points, 0).toFixed(2))} poin
          </span>
        </div>

        {/* Active Collective Action Bar when 1+ questions are selected */}
        {validSelectedIds.length > 0 && (
          <div
            data-testid="collective-selection-bar"
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/70 dark:bg-indigo-950/40 px-4 py-3 text-xs"
          >
            <div className="font-semibold text-indigo-900 dark:text-indigo-200">
              {validSelectedIds.length} soal terpilih
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowWeightPanel(true);
                  setShowCollectiveEditor(false);
                }}
                className="inline-flex items-center gap-1 rounded-lg border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50"
              >
                <Scale className="h-3.5 w-3.5" />
                <span>Atur Bobot Terpilih</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowCollectiveEditor(true);
                  setShowWeightPanel(false);
                }}
                className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1.5 font-semibold text-white hover:bg-indigo-700"
              >
                <Edit3 className="h-3.5 w-3.5" />
                <span>Edit Kolektif Terpilih</span>
              </button>

              {otherPackages.length > 0 && (
                <div className="inline-flex flex-wrap items-center gap-1.5">
                  <select
                    value={transferTargetPkgId}
                    onChange={(e) => setTransferTargetPkgId(e.target.value)}
                    aria-label="Pilih paket tujuan"
                    className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-xs text-slate-800 dark:text-slate-100 max-w-[160px]"
                  >
                    <option value="">Paket tujuan...</option>
                    {otherPackages.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!transferTargetPkgId}
                    onClick={() => handleTransferSelected('copy')}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 font-semibold text-slate-700 dark:text-slate-200 disabled:opacity-40"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    <span>Salin</span>
                  </button>
                  <button
                    type="button"
                    disabled={!transferTargetPkgId}
                    onClick={() => handleTransferSelected('move')}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 font-semibold text-slate-700 dark:text-slate-200 disabled:opacity-40"
                  >
                    <FolderInput className="h-3.5 w-3.5" />
                    <span>Pindah</span>
                  </button>
                </div>
              )}

              {!confirmBulkDelete ? (
                <button
                  type="button"
                  onClick={() => setConfirmBulkDelete(true)}
                  className="inline-flex items-center gap-1 rounded-lg border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1.5 font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Hapus ({validSelectedIds.length})</span>
                </button>
              ) : (
                <div className="inline-flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleBulkDeleteSelected}
                    className="rounded-lg bg-rose-600 px-2.5 py-1.5 font-semibold text-white hover:bg-rose-700"
                  >
                    Konfirmasi Hapus
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmBulkDelete(false)}
                    className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-slate-600 dark:text-slate-300"
                  >
                    Batal
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {pkgQuestions.map((q, index) => {
          const isSelected = validSelectedIds.includes(q.id);
          return (
          <article
            key={q.id}
            className={`rounded-xl border p-5 space-y-3 transition-colors ${
              isSelected
                ? 'border-indigo-400 dark:border-indigo-700 bg-indigo-50/30 dark:bg-indigo-950/20'
                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleSelectQuestion(q.id)}
                  aria-label={`Pilih soal nomor ${index + 1}`}
                  className="mt-1 h-4 w-4 rounded border-slate-400 text-indigo-600 shrink-0"
                />
                <div className="space-y-1 min-w-0">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-mono font-bold text-slate-900 dark:text-slate-100">No. {index + 1}</span>
                    <span className="mx-1.5">·</span>
                    <span className="font-semibold text-indigo-700 dark:text-indigo-400">
                      {QUESTION_TYPE_LABELS[q.type]}
                    </span>
                    <span className="mx-1.5">·</span>
                    <span className="font-mono">{q.points} poin</span>
                  </div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100 leading-relaxed">
                    {q.prompt}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => openEditQuestion(q)}
                  aria-label={`Edit soal nomor ${index + 1}`}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => deleteQuestion(q.id)}
                  aria-label={`Hapus soal nomor ${index + 1}`}
                  className="rounded-lg border border-rose-200 dark:border-rose-800 p-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {q.imageUrl && (
              <div className="max-w-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2">
                <img
                  src={q.imageUrl}
                  alt={`Ilustrasi soal nomor ${index + 1}`}
                  referrerPolicy="no-referrer"
                  className="max-h-44 w-full object-contain rounded"
                />
              </div>
            )}

            {(q.type === 'single_choice' || q.type === 'multiple_choice') && q.options && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {q.options.map((opt) => {
                  const isKey =
                    q.type === 'single_choice'
                      ? q.correctOptionId === opt.id
                      : q.correctOptionIds?.includes(opt.id);
                  return (
                    <div
                      key={opt.id}
                      className={`rounded-lg border px-3 py-2 ${
                        isKey
                          ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 font-semibold'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <span className="font-mono font-bold mr-2">{opt.id}.</span>
                      <span>{opt.text}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {q.type === 'matching' && q.matchingPairs && (
              <div className="space-y-1.5 text-xs">
                {q.matchingPairs.map((pair) => (
                  <div
                    key={pair.id}
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/50 px-3 py-2"
                  >
                    <span className="font-semibold text-slate-900 dark:text-slate-100">{pair.left}</span>
                    <span className="text-slate-400">↔</span>
                    <span className="font-medium text-emerald-800 dark:text-emerald-300">{pair.right}</span>
                  </div>
                ))}
              </div>
            )}

            {q.type === 'true_false' && (
              <div className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                Kunci Jawaban: {q.correctBoolean ? 'BENAR' : 'SALAH'}
              </div>
            )}

            {q.explanation && (
              <div className="border-t border-slate-100 dark:border-slate-800 pt-2.5 text-xs text-slate-600 dark:text-slate-400">
                <span className="font-semibold text-slate-800 dark:text-slate-200">Pembahasan: </span>
                {q.explanation}
              </div>
            )}
          </article>
          );
        })}

        {pkgQuestions.length === 0 && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center space-y-3">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Belum ada butir soal pada paket ujian ini.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={openNewQuestion}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
              >
                Tambah Soal Pertama
              </button>
              <button
                type="button"
                onClick={handleDownloadQuestionTemplate}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                <FileDown className="h-3.5 w-3.5" />
                <span>Download Format Import</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
