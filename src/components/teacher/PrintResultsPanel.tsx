import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Download,
  FileText,
  Printer,
  Search,
  Users,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useCBT } from '../../context/CBTContext';
import type { ExamAttempt, TeacherAccount } from '../../types/cbt';
import { resolveEffectiveAttemptStatus } from '../../utils/cbtLogic';

type StatusFilter = 'ALL' | 'finished' | 'passed' | 'remedial';

function sanitizeFileSegment(raw: string): string {
  return (
    raw
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'laporan'
  );
}

export function PrintResultsPanel({
  teacher,
  selectedPackageId,
  onSelectPackage,
}: {
  teacher: TeacherAccount;
  selectedPackageId: string;
  onSelectPackage: (id: string) => void;
}) {
  const { db } = useCBT();
  const myPackages = db.packages.filter((p) => p.teacherId === teacher.id);
  const currentPkg =
    myPackages.find((p) => p.id === selectedPackageId) || myPackages[0];

  const [classFilter, setClassFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [search, setSearch] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const pkgQuestions = useMemo(
    () =>
      currentPkg
        ? db.questions.filter((q) => q.packageId === currentPkg.id)
        : [],
    [currentPkg, db.questions]
  );

  const pkgAttempts = useMemo(() => {
    if (!currentPkg) return [];
    return db.attempts.filter((a) => a.packageId === currentPkg.id);
  }, [currentPkg, db.attempts]);

  const targetStudents = useMemo(() => {
    if (!currentPkg) return [];
    return db.students.filter((s) =>
      currentPkg.targetClasses.includes(s.className)
    );
  }, [currentPkg, db.students]);

  const mergedRows = useMemo(() => {
    if (!currentPkg) return [];
    const byKey = new Map<
      string,
      {
        studentId: string;
        nisn: string;
        name: string;
        className: string;
        attempt?: ExamAttempt;
        effectiveStatus: 'not_started' | 'in_progress' | 'completed' | 'locked';
      }
    >();

    targetStudents.forEach((stu) => {
      const attempt = pkgAttempts.find(
        (a) => a.studentId === stu.id || a.studentNisn === stu.nisn
      );
      const effectiveStatus = attempt
        ? resolveEffectiveAttemptStatus(
            attempt,
            db.security.maxViolationTolerance
          )
        : 'not_started';
      byKey.set(stu.nisn, {
        studentId: stu.id,
        nisn: stu.nisn,
        name: stu.name,
        className: stu.className,
        attempt,
        effectiveStatus,
      });
    });

    pkgAttempts.forEach((att) => {
      if (!byKey.has(att.studentNisn)) {
        byKey.set(att.studentNisn, {
          studentId: att.studentId,
          nisn: att.studentNisn,
          name: att.studentName,
          className: att.className,
          attempt: att,
          effectiveStatus: resolveEffectiveAttemptStatus(
            att,
            db.security.maxViolationTolerance
          ),
        });
      }
    });

    return Array.from(byKey.values()).sort((a, b) => {
      const clsCmp = a.className.localeCompare(b.className);
      if (clsCmp !== 0) return clsCmp;
      return a.name.localeCompare(b.name);
    });
  }, [
    currentPkg,
    db.security.maxViolationTolerance,
    pkgAttempts,
    targetStudents,
  ]);

  const classOptions = useMemo(() => {
    const set = new Set<string>(currentPkg?.targetClasses || []);
    mergedRows.forEach((r) => set.add(r.className));
    return Array.from(set).sort();
  }, [currentPkg, mergedRows]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return mergedRows.filter((row) => {
      if (classFilter !== 'ALL' && row.className !== classFilter) return false;
      if (
        statusFilter === 'finished' &&
        row.effectiveStatus !== 'completed' &&
        row.effectiveStatus !== 'locked'
      ) {
        return false;
      }
      if (statusFilter === 'passed') {
        const finished =
          row.effectiveStatus === 'completed' || row.effectiveStatus === 'locked';
        if (!finished || (row.attempt?.score ?? -1) < (currentPkg?.kkm ?? 75)) {
          return false;
        }
      }
      if (statusFilter === 'remedial') {
        const finished =
          row.effectiveStatus === 'completed' || row.effectiveStatus === 'locked';
        if (!finished || (row.attempt?.score ?? 100) >= (currentPkg?.kkm ?? 75)) {
          return false;
        }
      }
      if (q) {
        return (
          row.name.toLowerCase().includes(q) ||
          row.nisn.toLowerCase().includes(q) ||
          row.className.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [classFilter, currentPkg?.kkm, mergedRows, search, statusFilter]);

  const stats = useMemo(() => {
    const finished = filteredRows.filter(
      (r) =>
        (r.effectiveStatus === 'completed' || r.effectiveStatus === 'locked') &&
        typeof r.attempt?.score === 'number'
    );
    const scores = finished.map((r) => r.attempt?.score ?? 0);
    const kkm = currentPkg?.kkm ?? 75;
    const passed = scores.filter((s) => s >= kkm).length;
    const avg =
      scores.length > 0
        ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) /
          10
        : 0;
    return {
      total: filteredRows.length,
      finished: finished.length,
      avg,
      highest: scores.length > 0 ? Math.max(...scores) : 0,
      lowest: scores.length > 0 ? Math.min(...scores) : 0,
      passed,
      remedial: finished.length - passed,
    };
  }, [currentPkg?.kkm, filteredRows]);

  const formatStatusText = (
    status: 'not_started' | 'in_progress' | 'completed' | 'locked'
  ) => {
    if (status === 'completed') return 'Selesai';
    if (status === 'locked') return 'Terkunci';
    if (status === 'in_progress') return 'Mengerjakan';
    return 'Belum Mulai';
  };

  const handleDownloadClassPDF = () => {
    if (!currentPkg) return;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header / Kop Laporan Sekolah
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(db.school.schoolName.toUpperCase(), pageWidth / 2, 16, {
      align: 'center',
    });
    doc.setFontSize(11);
    doc.text('LAPORAN HASIL EVALUASI UJIAN CBT', pageWidth / 2, 22, {
      align: 'center',
    });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(
      `Tahun Ajaran ${db.school.academicYear} · Dicetak: ${new Date().toLocaleString('id-ID')}`,
      pageWidth / 2,
      27,
      { align: 'center' }
    );
    doc.setLineWidth(0.5);
    doc.line(14, 30, pageWidth - 14, 30);

    // Exam Metadata
    doc.setFontSize(9);
    const metaLeftMaxWidth = pageWidth / 2 - 18;
    const metaLeft = [
      `Paket Ujian   : ${currentPkg.title}`,
      `Mata Pelajaran: ${currentPkg.subject} (${currentPkg.category})`,
      `Guru Pengampu : ${teacher.name}`,
    ];
    const metaRight = [
      `Filter Kelas  : ${classFilter === 'ALL' ? currentPkg.targetClasses.join(', ') : classFilter}`,
      `KKM / Soal    : ${currentPkg.kkm} / ${pkgQuestions.length} butir`,
      `Rata-rata     : ${stats.avg} (Lulus: ${stats.passed}, Remedial: ${stats.remedial})`,
    ];
    metaLeft.forEach((line, idx) => {
      const clipped = doc.splitTextToSize(line, metaLeftMaxWidth)[0] || line;
      doc.text(clipped, 14, 36 + idx * 5);
    });
    metaRight.forEach((line, idx) => doc.text(line, pageWidth / 2 + 4, 36 + idx * 5));

    // Grade Table
    const tableBody = filteredRows.map((row, index) => {
      const finished =
        row.effectiveStatus === 'completed' || row.effectiveStatus === 'locked';
      const scoreVal = finished ? row.attempt?.score ?? 0 : null;
      const predicate =
        scoreVal === null
          ? '-'
          : scoreVal >= currentPkg.kkm
            ? 'Tuntas'
            : 'Remedial';
      return [
        String(index + 1),
        row.nisn,
        row.name,
        row.className,
        formatStatusText(row.effectiveStatus),
        scoreVal !== null ? String(scoreVal) : '-',
        predicate,
        row.attempt ? `${row.attempt.violationCount}x` : '0x',
      ];
    });

    autoTable(doc, {
      startY: 54,
      head: [
        [
          'No',
          'NISN',
          'Nama Peserta',
          'Kelas',
          'Status',
          'Nilai',
          'Ket.',
          'Pelanggaran',
        ],
      ],
      body:
        tableBody.length > 0
          ? tableBody
          : [['-', '-', 'Tidak ada data peserta sesuai filter', '-', '-', '-', '-', '-']],
      styles: { fontSize: 8.5, cellPadding: 2.5 },
      headStyles: { fillColor: [67, 56, 202], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        1: { cellWidth: 26 },
        3: { halign: 'center', cellWidth: 20 },
        4: { halign: 'center', cellWidth: 22 },
        5: { halign: 'center', cellWidth: 15, fontStyle: 'bold' },
        6: { halign: 'center', cellWidth: 18 },
        7: { halign: 'center', cellWidth: 20 },
      },
    });

    // Signature block
    const finalY =
      (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable
        ?.finalY ?? 120;
    const signY = Math.min(finalY + 14, 260);
    doc.setFontSize(9);
    doc.text(
      `Kabun, ${new Date().toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })}`,
      pageWidth - 68,
      signY
    );
    doc.text('Guru Mata Pelajaran,', pageWidth - 68, signY + 5);
    doc.setFont('helvetica', 'bold');
    doc.text(teacher.name, pageWidth - 68, signY + 22);
    doc.setFont('helvetica', 'normal');
    doc.text(`NIP. ${teacher.nip}`, pageWidth - 68, signY + 27);

    const fileName = `Laporan-Hasil-${sanitizeFileSegment(currentPkg.subject)}-${sanitizeFileSegment(
      classFilter === 'ALL' ? 'semua-kelas' : classFilter
    )}.pdf`;
    doc.save(fileName);
    setFeedback(`File PDF "${fileName}" berhasil dibuat dan diunduh.`);
  };

  const handleDownloadStudentPDF = (attempt: ExamAttempt) => {
    if (!currentPkg) return;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(db.school.schoolName.toUpperCase(), pageWidth / 2, 15, {
      align: 'center',
    });
    doc.setFontSize(10.5);
    doc.text('LEMBAR HASIL EVALUASI INDIVIDU PESERTA', pageWidth / 2, 21, {
      align: 'center',
    });
    doc.setLineWidth(0.4);
    doc.line(14, 25, pageWidth - 14, 25);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Nama Peserta  : ${attempt.studentName}`, 14, 32);
    doc.text(`NISN / Kelas  : ${attempt.studentNisn} / ${attempt.className}`, 14, 37);
    doc.text(`Paket Ujian   : ${currentPkg.title} (${currentPkg.subject})`, 14, 42);
    doc.text(
      `Nilai Akhir   : ${attempt.score ?? 0} (${(attempt.score ?? 0) >= currentPkg.kkm ? 'LULUS KKM' : 'REMEDIAL'} · KKM ${currentPkg.kkm})`,
      14,
      47
    );
    doc.text(
      `Pelanggaran   : ${attempt.violationCount}x · Status: ${formatStatusText(
        resolveEffectiveAttemptStatus(attempt, db.security.maxViolationTolerance)
      )}`,
      14,
      52
    );

    const rows = pkgQuestions.map((q, idx) => {
      const ans = attempt.answers[q.id];
      const essayGrade = attempt.essayGrades?.[q.id];
      let studentAnsText = 'Tidak dijawab';
      let keyText = '-';
      let resultText = '-';

      if (q.type === 'essay') {
        studentAnsText =
          typeof ans === 'string' && ans.trim() ? ans.trim() : 'Tidak dijawab';
        keyText = q.essayAnswerKey || '-';
        resultText = essayGrade
          ? `${essayGrade.matchPercent}% (${essayGrade.earnedPoints}/${essayGrade.maxPoints} poin)`
          : '-';
      } else if (q.type === 'single_choice') {
        studentAnsText = typeof ans === 'string' ? ans : 'Tidak dijawab';
        keyText = q.correctOptionId || '-';
        resultText = ans === q.correctOptionId ? `Benar (+${q.points})` : 'Salah (0)';
      } else if (q.type === 'multiple_choice') {
        studentAnsText = Array.isArray(ans) && ans.length > 0 ? ans.join(', ') : 'Tidak dijawab';
        keyText = (q.correctOptionIds || []).join(', ');
        const matched =
          Array.isArray(ans) &&
          [...ans].sort().join(',') === [...(q.correctOptionIds || [])].sort().join(',');
        resultText = matched ? `Benar (+${q.points})` : 'Salah (0)';
      } else if (q.type === 'true_false') {
        studentAnsText =
          typeof ans === 'boolean' ? (ans ? 'BENAR' : 'SALAH') : 'Tidak dijawab';
        keyText = q.correctBoolean ? 'BENAR' : 'SALAH';
        resultText = ans === q.correctBoolean ? `Benar (+${q.points})` : 'Salah (0)';
      } else if (q.type === 'matching') {
        studentAnsText =
          ans && typeof ans === 'object' && !Array.isArray(ans)
            ? Object.entries(ans)
                .map(([k, v]) => `${k}: ${v}`)
                .join('; ')
            : 'Tidak dijawab';
        keyText = (q.matchingPairs || []).map((p) => `${p.left}=${p.right}`).join('; ');
        resultText = 'Auto';
      }

      return [
        String(idx + 1),
        q.prompt.slice(0, 90) + (q.prompt.length > 90 ? '...' : ''),
        studentAnsText.slice(0, 120),
        keyText.slice(0, 100),
        resultText,
      ];
    });

    autoTable(doc, {
      startY: 58,
      head: [['No', 'Ringkasan Soal', 'Jawaban Siswa', 'Kunci', 'Hasil']],
      body: rows,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [67, 56, 202], textColor: 255 },
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        4: { cellWidth: 28 },
      },
    });

    const fileName = `Hasil-${sanitizeFileSegment(attempt.studentName)}-${sanitizeFileSegment(
      currentPkg.subject
    )}.pdf`;
    doc.save(fileName);
    setFeedback(`PDF individu untuk ${attempt.studentName} berhasil diunduh.`);
  };

  if (!currentPkg) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-sm text-slate-600 dark:text-slate-400">
        Buat paket ujian terlebih dahulu pada menu Paket Ujian Saya untuk mencetak hasil evaluasi.
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="print-results-panel">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Cetak Hasil Evaluasi (PDF)
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Unduh laporan nilai kelas dan lembar hasil individu peserta (termasuk koreksi esai) dalam format PDF siap cetak.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={currentPkg.id}
            onChange={(e) => {
              onSelectPackage(e.target.value);
              setClassFilter('ALL');
            }}
            aria-label="Pilih paket ujian untuk cetak hasil"
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 max-w-xs"
          >
            {myPackages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title} ({p.subject})
              </option>
            ))}
          </select>

          <button
            type="button"
            data-testid="download-class-pdf-btn"
            onClick={handleDownloadClassPDF}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 whitespace-nowrap"
          >
            <Download className="h-4 w-4" />
            <span>Download Laporan PDF</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div
          role="status"
          className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 px-4 py-3 text-xs font-medium text-emerald-800 dark:text-emerald-200"
        >
          {feedback}
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Total Peserta</span>
            <Users className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="mt-1.5 font-mono text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
            {stats.total}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            {stats.finished} selesai dinilai
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Rata-Rata Nilai</span>
            <FileText className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="mt-1.5 font-mono text-2xl font-bold text-indigo-700 dark:text-indigo-400 tabular-nums">
            {stats.avg}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            KKM Paket: {currentPkg.kkm}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Tertinggi / Terendah</span>
            <Printer className="h-4 w-4 text-slate-400" />
          </div>
          <div className="mt-1.5 font-mono text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
            {stats.highest} <span className="text-sm text-slate-400">/ {stats.lowest}</span>
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Rentang skor kelas
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Ketuntasan KKM</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-1.5 font-mono text-2xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
            {stats.passed} <span className="text-sm text-rose-600 dark:text-rose-400">/ {stats.remedial}</span>
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Tuntas / Remedial
          </div>
        </div>
      </div>

      {/* Filters & Preview Table */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              aria-label="Filter kelas cetak hasil"
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200"
            >
              <option value="ALL">Semua Kelas ({classOptions.length})</option>
              {classOptions.map((cls) => (
                <option key={cls} value={cls}>
                  Kelas {cls}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              aria-label="Filter status kelulusan"
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200"
            >
              <option value="ALL">Semua Status</option>
              <option value="finished">Sudah Selesai</option>
              <option value="passed">Tuntas KKM</option>
              <option value="remedial">Remedial</option>
            </select>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama atau NISN..."
              aria-label="Cari peserta cetak hasil"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:border-indigo-600 focus:outline-none"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3 font-semibold w-12">No</th>
                <th className="px-4 py-3 font-semibold">Peserta</th>
                <th className="px-4 py-3 font-semibold">Kelas</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold text-center">Nilai</th>
                <th className="px-4 py-3 font-semibold text-center">Keterangan</th>
                <th className="px-4 py-3 font-semibold text-center">Pelanggaran</th>
                <th className="px-4 py-3 font-semibold text-right">Cetak Individu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredRows.map((row, index) => {
                const finished =
                  row.effectiveStatus === 'completed' ||
                  row.effectiveStatus === 'locked';
                const score = finished ? row.attempt?.score ?? 0 : null;
                const isPassed = score !== null && score >= currentPkg.kkm;
                return (
                  <tr
                    key={`${row.nisn}-${row.studentId}`}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                  >
                    <td className="px-4 py-3 font-mono text-slate-500 tabular-nums">
                      {index + 1}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {row.name}
                      </div>
                      <div className="font-mono text-[11px] text-slate-500">
                        {row.nisn}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">
                      {row.className}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`font-semibold ${
                          row.effectiveStatus === 'completed'
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : row.effectiveStatus === 'locked'
                              ? 'text-rose-700 dark:text-rose-400'
                              : row.effectiveStatus === 'in_progress'
                                ? 'text-indigo-700 dark:text-indigo-400'
                                : 'text-slate-400'
                        }`}
                      >
                        {formatStatusText(row.effectiveStatus)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center font-mono font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                      {score !== null ? score : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {score === null ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        <span
                          className={`font-semibold ${
                            isPassed
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-rose-700 dark:text-rose-400'
                          }`}
                        >
                          {isPassed ? 'Tuntas' : 'Remedial'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center font-mono tabular-nums text-slate-600 dark:text-slate-300">
                      {row.attempt ? `${row.attempt.violationCount}x` : '0x'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {row.attempt && finished ? (
                        <button
                          type="button"
                          onClick={() => handleDownloadStudentPDF(row.attempt!)}
                          className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/70 dark:bg-indigo-950/40 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100"
                        >
                          <Download className="h-3 w-3" />
                          <span>PDF</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400">Belum selesai</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredRows.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-10 text-center text-slate-500 dark:text-slate-400"
                  >
                    Tidak ada peserta sesuai filter yang dipilih.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
