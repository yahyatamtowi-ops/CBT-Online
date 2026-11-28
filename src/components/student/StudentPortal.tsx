import React, { useEffect, useState } from 'react';
import { useCBT } from '../../context/CBTContext';
import {
  findStudentPackageAttempt,
  resolveEffectiveAttemptStatus,
} from '../../utils/cbtLogic';
import { ExamResultView } from './ExamResultView';
import { ExamWorkspace } from './ExamWorkspace';
import { PreFlightCheck } from './PreFlightCheck';
import { StudentExamDashboard } from './StudentExamDashboard';

type StudentPortalView = 'dashboard' | 'preflight' | 'workspace' | 'result';

export function StudentPortal() {
  const { db, session, logout, startOrResumeAttempt } = useCBT();
  const [view, setView] = useState<StudentPortalView>('dashboard');
  const [selectedPackageId, setSelectedPackageId] = useState<string | undefined>(
    session?.packageId
  );

  const student = db.students.find(
    (s) =>
      s.id === session?.userId ||
      (session?.nisn && s.nisn.trim() === session.nisn.trim())
  );
  const activePackageId = selectedPackageId || session?.packageId;
  const examPackage = db.packages.find((p) => p.id === activePackageId);
  const existingAttempt =
    student && examPackage
      ? findStudentPackageAttempt(
          db.attempts,
          student,
          examPackage.id,
          db.security.maxViolationTolerance
        )
      : undefined;
  const effectiveStatus = resolveEffectiveAttemptStatus(
    existingAttempt,
    db.security.maxViolationTolerance
  );

  useEffect(() => {
    if (session?.packageId && !selectedPackageId) {
      setSelectedPackageId(session.packageId);
    }
  }, [selectedPackageId, session?.packageId]);

  useEffect(() => {
    if (view === 'workspace' && student && examPackage && !existingAttempt) {
      startOrResumeAttempt(student.id, examPackage.id);
    }
  }, [examPackage, existingAttempt, startOrResumeAttempt, student, view]);

  // Auto-transition from active workspace to result view once submitted or locked,
  // and back to preflight if teacher unlocks a locked attempt!
  useEffect(() => {
    if (
      view === 'workspace' &&
      existingAttempt &&
      (effectiveStatus === 'completed' || effectiveStatus === 'locked')
    ) {
      setView('result');
    } else if (
      view === 'result' &&
      existingAttempt &&
      effectiveStatus === 'in_progress'
    ) {
      setView('preflight');
    }
  }, [effectiveStatus, existingAttempt, view]);

  if (!student) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 p-6 text-center space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Sesi peserta tidak valid atau data siswa tidak ditemukan.
        </p>
        <button
          type="button"
          onClick={logout}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
        >
          Kembali ke Halaman Login
        </button>
      </div>
    );
  }

  if (view === 'dashboard' || !examPackage) {
    return (
      <StudentExamDashboard
        student={student}
        activeSessionPackageId={session?.packageId}
        onSelectExamForStart={(packageId) => {
          setSelectedPackageId(packageId);
          setView('preflight');
        }}
        onSelectExamForResult={(packageId) => {
          setSelectedPackageId(packageId);
          setView('result');
        }}
        onLogout={logout}
      />
    );
  }

  const pkgQuestions = db.questions.filter((q) => q.packageId === examPackage.id);

  // If the selected exam is already completed or locked, show result view with option to return to dashboard
  if (
    view === 'result' ||
    (existingAttempt &&
      (effectiveStatus === 'completed' || effectiveStatus === 'locked'))
  ) {
    if (!existingAttempt) {
      return (
        <StudentExamDashboard
          student={student}
          activeSessionPackageId={session?.packageId}
          onSelectExamForStart={(packageId) => {
            setSelectedPackageId(packageId);
            setView('preflight');
          }}
          onSelectExamForResult={(packageId) => {
            setSelectedPackageId(packageId);
            setView('result');
          }}
          onLogout={logout}
        />
      );
    }

    return (
      <ExamResultView
        attempt={existingAttempt}
        examPackage={examPackage}
        questions={pkgQuestions}
        onBackToDashboard={() => setView('dashboard')}
        onLogout={logout}
      />
    );
  }

  if (view === 'preflight') {
    return (
      <PreFlightCheck
        student={student}
        examPackage={examPackage}
        existingAttempt={existingAttempt}
        questionCount={pkgQuestions.length}
        onStartExam={() => {
          startOrResumeAttempt(student.id, examPackage.id);
          setView('workspace');
        }}
        onBackToDashboard={() => setView('dashboard')}
        onLogout={logout}
      />
    );
  }

  if (!existingAttempt) {
    return null;
  }

  return (
    <ExamWorkspace
      attempt={existingAttempt}
      examPackage={examPackage}
      questions={pkgQuestions}
    />
  );
}
