import React, { useState } from 'react';
import {
  BookOpen,
  Clock,
  Copy,
  Edit3,
  Plus,
  Power,
  Shuffle,
  Trash2,
} from 'lucide-react';
import { useCBT } from '../../context/CBTContext';
import type { ExamCategory, ExamPackage, TeacherAccount } from '../../types/cbt';
import { ExamSummaryDashboard } from './ExamSummaryDashboard';

export function ExamPackageManager({
  teacher,
  selectedPackageId,
  onSelectPackage,
  onOpenQuestions,
  onOpenProctoring,
}: {
  teacher: TeacherAccount;
  selectedPackageId: string;
  onSelectPackage: (id: string) => void;
  onOpenQuestions: (packageId: string) => void;
  onOpenProctoring: (packageId: string) => void;
}) {
  const { db, upsertExamPackage, togglePackagePublished, deleteExamPackage } = useCBT();
  const myPackages = db.packages.filter((p) => p.teacherId === teacher.id);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState((teacher.subjects || [])[0] || 'Umum');
  const [targetClasses, setTargetClasses] = useState<string[]>(
    (teacher.classes || []).length > 0 ? teacher.classes : db.classes.slice(0, 1)
  );
  const [customClassInput, setCustomClassInput] = useState('');
  const [category, setCategory] = useState<ExamCategory>('Ulangan Resmi');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [minSubmitMinutes, setMinSubmitMinutes] = useState(15);
  const [kkm, setKkm] = useState(75);
  const [token, setToken] = useState('');
  const [shuffleQuestions, setShuffleQuestions] = useState(true);
  const [shuffleOptions, setShuffleOptions] = useState(true);
  const [isPublished, setIsPublished] = useState(true);
  const [allowIndependentAccess, setAllowIndependentAccess] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);

  const generateRandomToken = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let out = '';
    for (let i = 0; i < 6; i++) {
      out += chars[Math.floor(Math.random() * chars.length)];
    }
    setToken(out);
  };

  const openCreateForm = () => {
    setEditingId(null);
    setTitle('');
    setSubject((teacher.subjects || [])[0] || 'Umum');
    setTargetClasses(
      (teacher.classes || []).length > 0 ? teacher.classes : db.classes.slice(0, 1)
    );
    setCustomClassInput('');
    setCategory('Ulangan Resmi');
    setDurationMinutes(60);
    setMinSubmitMinutes(15);
    setKkm(75);
    generateRandomToken();
    setShuffleQuestions(true);
    setShuffleOptions(true);
    setIsPublished(true);
    setAllowIndependentAccess(true);
    setShowForm(true);
    setFeedback(null);
  };

  const openEditForm = (pkg: ExamPackage) => {
    setEditingId(pkg.id);
    setTitle(pkg.title);
    setSubject(pkg.subject);
    setTargetClasses(pkg.targetClasses);
    setCustomClassInput('');
    setCategory(pkg.category);
    setDurationMinutes(pkg.durationMinutes);
    setMinSubmitMinutes(pkg.minSubmitMinutes);
    setKkm(pkg.kkm);
    setToken(pkg.token);
    setShuffleQuestions(pkg.shuffleQuestions);
    setShuffleOptions(pkg.shuffleOptions);
    setIsPublished(pkg.isPublished);
    setAllowIndependentAccess(pkg.allowIndependentAccess ?? true);
    setShowForm(true);
    setFeedback(null);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const resolvedClasses =
      targetClasses.length > 0
        ? targetClasses
        : customClassInput
            .split(',')
            .map((c) => c.trim().toUpperCase())
            .filter(Boolean);

    if (!title.trim() || !token.trim() || resolvedClasses.length === 0) {
      setFeedback('Judul paket, Token Ujian, dan minimal 1 kelas target wajib diisi.');
      return;
    }
    const parsedDuration = Number(durationMinutes);
    const safeDuration = Number.isFinite(parsedDuration)
      ? Math.max(5, Math.min(240, Math.round(parsedDuration)))
      : 60;
    const parsedMinSubmit = Number(minSubmitMinutes);
    const safeMinSubmit = Number.isFinite(parsedMinSubmit)
      ? Math.max(0, Math.min(Math.round(parsedMinSubmit), safeDuration))
      : 0;
    const parsedKkm = Number(kkm);
    const safeKkm = Number.isFinite(parsedKkm)
      ? Math.max(0, Math.min(100, Math.round(parsedKkm)))
      : 75;

    const id = upsertExamPackage({
      id: editingId || undefined,
      teacherId: teacher.id,
      title: title.trim(),
      subject: subject.trim(),
      targetClasses: resolvedClasses,
      category,
      durationMinutes: safeDuration,
      minSubmitMinutes: safeMinSubmit,
      kkm: safeKkm,
      token: token.trim().toUpperCase(),
      shuffleQuestions,
      shuffleOptions,
      isPublished,
      allowIndependentAccess,
    });
    onSelectPackage(id);
    setShowForm(false);
    setFeedback(editingId ? 'Paket ujian berhasil diperbarui.' : 'Paket ujian baru berhasil dibuat.');
  };

  const availableClasses =
    teacher.classes.length > 0 ? teacher.classes : db.classes;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Paket Ujian Saya
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Mapel: {teacher.subjects.join(' · ')}
            {teacher.classes.length > 0 ? ` · Kelas: ${teacher.classes.join(', ')}` : ''}
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateForm}
          className="inline-flex w-full sm:w-auto items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 whitespace-nowrap"
        >
          <Plus className="h-4 w-4" />
          <span>Buat Paket Ujian</span>
        </button>
      </div>

      {feedback && (
        <div
          role="status"
          className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 px-4 py-3 text-xs font-medium text-emerald-800 dark:text-emerald-200"
        >
          {feedback}
        </div>
      )}

      {/* D3.js Exam Summary Dashboard Widget */}
      <ExamSummaryDashboard
        packages={myPackages}
        attempts={db.attempts}
        violations={db.violations}
        onOpenProctoring={onOpenProctoring}
      />

      {/* Package Form */}
      {showForm && (
        <form
          onSubmit={handleSave}
          className="rounded-xl border border-indigo-200 dark:border-indigo-900 bg-white dark:bg-slate-900 p-6 space-y-5"
        >
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              {editingId ? 'Edit Konfigurasi Paket Ujian' : 'Buat Paket Ujian Baru'}
            </h2>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            >
              Tutup
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="sm:col-span-2">
              <label htmlFor="pkg-title" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Judul Paket Ujian
              </label>
              <input
                id="pkg-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Contoh: Ulangan Harian Bab 3"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-indigo-600 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="pkg-subject" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Mata Pelajaran
              </label>
              <select
                id="pkg-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-indigo-600 focus:outline-none"
              >
                {teacher.subjects.map((sub) => (
                  <option key={sub} value={sub}>
                    {sub}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="pkg-category" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Kategori Ujian
              </label>
              <select
                id="pkg-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as ExamCategory)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-indigo-600 focus:outline-none"
              >
                <option value="Ulangan Resmi">Ulangan Resmi</option>
                <option value="UTS / PTS">UTS / PTS</option>
                <option value="Latihan Mandiri">Latihan Mandiri</option>
              </select>
            </div>

            <div>
              <label htmlFor="pkg-duration" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Durasi Ujian (Menit)
              </label>
              <input
                id="pkg-duration"
                type="number"
                min={5}
                max={240}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100 focus:border-indigo-600 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="pkg-min-submit" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Minimal Waktu Submit (Menit)
              </label>
              <input
                id="pkg-min-submit"
                type="number"
                min={0}
                max={120}
                value={minSubmitMinutes}
                onChange={(e) => setMinSubmitMinutes(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100 focus:border-indigo-600 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="pkg-kkm" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                KKM (0–100)
              </label>
              <input
                id="pkg-kkm"
                type="number"
                min={0}
                max={100}
                value={kkm}
                onChange={(e) => setKkm(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100 focus:border-indigo-600 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="pkg-token" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Token Ujian
              </label>
              <div className="flex gap-1.5">
                <input
                  id="pkg-token"
                  type="text"
                  value={token}
                  onChange={(e) => setToken(e.target.value.toUpperCase())}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-mono uppercase tracking-wider text-slate-900 dark:text-slate-100 focus:border-indigo-600 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={generateRandomToken}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
                >
                  Acak
                </button>
              </div>
            </div>

            <div>
              <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Hak Aktivasi Guru Mapel
              </span>
              <div className="space-y-1.5 pt-1">
                <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPublished}
                    onChange={(e) => setIsPublished(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600"
                  />
                  <span>Aktifkan soal sekarang (siap dikerjakan)</span>
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowIndependentAccess}
                    onChange={(e) => setAllowIndependentAccess(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600"
                  />
                  <span>Jadwal mandiri guru (Ulangan / Latihan / UTS)</span>
                </label>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-100 dark:border-slate-800 pt-4">
            <div>
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">Kelas Target</p>
              {availableClasses.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {availableClasses.map((cls) => {
                    const selected = targetClasses.includes(cls);
                    return (
                      <button
                        key={cls}
                        type="button"
                        onClick={() =>
                          setTargetClasses((prev) =>
                            selected ? prev.filter((c) => c !== cls) : [...prev, cls]
                          )
                        }
                        className={`rounded-md border px-2.5 py-1 text-xs font-medium ${
                          selected
                            ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300'
                            : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        {cls}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <input
                  type="text"
                  value={customClassInput}
                  onChange={(e) => setCustomClassInput(e.target.value)}
                  placeholder="Ketik kelas dipisah koma (misal: X-IPA-1, X-IPA-2)"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
                />
              )}
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Opsi Pengacakan</p>
              <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={shuffleQuestions}
                  onChange={(e) => setShuffleQuestions(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600"
                />
                <span>Acak Urutan Soal per siswa</span>
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={shuffleOptions}
                  onChange={(e) => setShuffleOptions(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600"
                />
                <span>Acak Opsi Jawaban (A–E)</span>
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Batal
            </button>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
            >
              Simpan Paket Ujian
            </button>
          </div>
        </form>
      )}

      {/* Packages Grid */}
      {myPackages.length === 0 ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Belum ada paket ujian yang dibuat. Klik tombol Buat Paket Ujian untuk memulai.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-2">
          {myPackages.map((pkg) => {
            const qCount = db.questions.filter((q) => q.packageId === pkg.id).length;
            const attemptCount = db.attempts.filter((a) => a.packageId === pkg.id).length;
            const isSelected = selectedPackageId === pkg.id;

            return (
              <div
                key={pkg.id}
                className={`rounded-xl border bg-white dark:bg-slate-900 p-3.5 sm:p-5 space-y-3 sm:space-y-4 transition-colors ${
                  isSelected
                    ? 'border-indigo-500 ring-1 ring-indigo-500/20'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-semibold text-indigo-700 dark:text-indigo-400">{pkg.subject}</span>
                      <span className="mx-1.5">·</span>
                      <span>{pkg.category}</span>
                      <span className="mx-1.5">·</span>
                      <span
                        className={
                          pkg.isPublished
                            ? 'text-emerald-700 dark:text-emerald-400 font-semibold'
                            : 'text-amber-700 dark:text-amber-400 font-semibold'
                        }
                      >
                        {pkg.isPublished ? 'Aktif — Dapat Dikerjakan' : 'Nonaktif (Draf)'}
                      </span>
                    </div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">{pkg.title}</h2>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">Token</div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(pkg.token).catch(() => {});
                        setFeedback(`Token ${pkg.token} disalin ke papan klip.`);
                      }}
                      className="inline-flex items-center gap-1 font-mono text-sm font-bold text-indigo-700 dark:text-indigo-400 hover:underline"
                      title="Salin token"
                    >
                      <span>{pkg.token}</span>
                      <Copy className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 border-y border-slate-100 dark:border-slate-800 py-3 text-xs">
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block">Butir Soal</span>
                    <span className="font-mono font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                      {qCount} soal
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block">Durasi / Min</span>
                    <span className="font-mono font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                      {pkg.durationMinutes}m / {pkg.minSubmitMinutes}m
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block">KKM</span>
                    <span className="font-mono font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                      {pkg.kkm}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block">Peserta</span>
                    <span className="font-mono font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                      {attemptCount} siswa
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-slate-400" />
                      Kelas: {pkg.targetClasses.join(', ')}
                    </span>
                    {(pkg.shuffleQuestions || pkg.shuffleOptions) && (
                      <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400">
                        <Shuffle className="h-3.5 w-3.5" />
                        {[
                          pkg.shuffleQuestions && 'Acak Soal',
                          pkg.shuffleOptions && 'Acak Opsi',
                        ]
                          .filter(Boolean)
                          .join(' & ')}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      data-testid={`toggle-activate-pkg-${pkg.id}`}
                      onClick={() => {
                        const willActivate = !pkg.isPublished;
                        togglePackagePublished(pkg.id);
                        setFeedback(
                          willActivate
                            ? `Paket "${pkg.title}" diaktifkan. Siswa kelas ${pkg.targetClasses.join(', ')} sekarang dapat langsung mengerjakan ${pkg.category.toLowerCase()}.`
                            : `Paket "${pkg.title}" dinonaktifkan sementara.`
                        );
                      }}
                      className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                        pkg.isPublished
                          ? 'border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 hover:bg-amber-100'
                          : 'bg-emerald-600 text-white hover:bg-emerald-700'
                      }`}
                    >
                      <Power className="h-3.5 w-3.5" />
                      <span>{pkg.isPublished ? 'Nonaktifkan' : 'Aktifkan Soal'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenQuestions(pkg.id)}
                      className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 px-3 py-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 whitespace-nowrap"
                    >
                      <BookOpen className="h-3.5 w-3.5" />
                      <span>Bank Soal</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenProctoring(pkg.id)}
                      className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
                    >
                      Monitoring
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditForm(pkg)}
                      aria-label={`Edit paket ${pkg.title}`}
                      className="rounded-lg border border-slate-200 dark:border-slate-700 p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteExamPackage(pkg.id)}
                      aria-label={`Hapus paket ${pkg.title}`}
                      className="rounded-lg border border-rose-200 dark:border-rose-800 p-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
