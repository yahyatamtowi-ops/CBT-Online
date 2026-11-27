import React, { useEffect, useState } from 'react';
import {
  Ban,
  CheckCircle2,
  Download,
  Edit3,
  KeyRound,
  Plus,
  Search,
  Trash2,
  Upload,
  UserPlus,
} from 'lucide-react';
import { useCBT } from '../../context/CBTContext';
import type { StudentRecord, TeacherAccount } from '../../types/cbt';
import {
  generateStudentsCSVTemplate,
  generateTeachersCSVTemplate,
  parseStudentsCSV,
  parseTeachersCSV,
} from '../../utils/cbtLogic';

function downloadTextFile(filename: string, content: string, mime = 'text/csv;charset=utf-8;') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function UserManagement() {
  const {
    db,
    upsertTeacher,
    importTeachersBatch,
    toggleTeacherActive,
    bulkSetTeachersActive,
    deleteTeacher,
    bulkDeleteTeachers,
    upsertStudent,
    importStudentsBatch,
    toggleStudentActive,
    bulkSetStudentsActive,
    deleteStudent,
    bulkDeleteStudents,
    addClassRoom,
    deleteClassRoom,
    bulkDeleteClassRooms,
    updateAdminAccount,
  } = useCBT();

  const [subTab, setSubTab] = useState<'students' | 'teachers' | 'classes' | 'admin_account'>(
    'students'
  );
  const [search, setSearch] = useState('');
  const [filterClass, setFilterClass] = useState('ALL');
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Bulk selection states (Data Siswa, Data Guru, Daftar Kelas)
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [confirmBulkDeleteStudents, setConfirmBulkDeleteStudents] = useState(false);
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>([]);
  const [confirmBulkDeleteTeachers, setConfirmBulkDeleteTeachers] = useState(false);
  const [selectedClassNames, setSelectedClassNames] = useState<string[]>([]);
  const [confirmBulkDeleteClasses, setConfirmBulkDeleteClasses] = useState(false);

  // Student form state
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [stuNisn, setStuNisn] = useState('');
  const [stuName, setStuName] = useState('');
  const [stuClass, setStuClass] = useState(db.classes[0] || '');
  const [stuActive, setStuActive] = useState(true);

  useEffect(() => {
    if (!stuClass && db.classes.length > 0) {
      setStuClass(db.classes[0]);
    }
  }, [db.classes, stuClass]);

  // Student CSV Import state
  const [showStudentCsvModal, setShowStudentCsvModal] = useState(false);
  const [studentCsvText, setStudentCsvText] = useState('');

  // Teacher form state
  const [editingTeacherId, setEditingTeacherId] = useState<string | null>(null);
  const [tUsername, setTUsername] = useState('');
  const [tNip, setTNip] = useState('');
  const [tName, setTName] = useState('');
  const [tPassword, setTPassword] = useState('');
  const [tSubjects, setTSubjects] = useState('');
  const [tClasses, setTClasses] = useState<string[]>([]);
  const [showTeacherCsvModal, setShowTeacherCsvModal] = useState(false);
  const [teacherCsvText, setTeacherCsvText] = useState('');

  // Class form state
  const [newClassName, setNewClassName] = useState('');

  // Super Admin Account Edit form state
  const [adminDisplayName, setAdminDisplayName] = useState(db.adminAccount.displayName);
  const [adminUsername, setAdminUsername] = useState(db.adminAccount.username);
  const [adminCurrentPass, setAdminCurrentPass] = useState('');
  const [adminNewPass, setAdminNewPass] = useState('');
  const [adminConfirmPass, setAdminConfirmPass] = useState('');

  const handleSaveStudent = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    if (!stuNisn.trim() || !stuName.trim() || !stuClass.trim()) {
      setFeedback({ type: 'err', text: 'NISN, Nama Lengkap, dan Kelas wajib diisi.' });
      return;
    }
    const res = upsertStudent({
      id: editingStudentId || undefined,
      nisn: stuNisn.trim(),
      name: stuName.trim(),
      className: stuClass.trim().toUpperCase(),
      active: stuActive,
    });
    if (!res.ok) {
      setFeedback({ type: 'err', text: res.error || 'Gagal menyimpan siswa.' });
      return;
    }
    setFeedback({
      type: 'ok',
      text: editingStudentId ? 'Data siswa diperbarui.' : 'Siswa baru berhasil ditambahkan.',
    });
    if (!editingStudentId) {
      setFilterClass('ALL');
      setSearch('');
    }
    setEditingStudentId(null);
    setStuNisn('');
    setStuName('');
    setStuActive(true);
  };

  const startEditStudent = (s: StudentRecord) => {
    setEditingStudentId(s.id);
    setStuNisn(s.nisn);
    setStuName(s.name);
    setStuClass(s.className);
    setStuActive(s.active);
    setFeedback(null);
  };

  const handleStudentCsvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setStudentCsvText(reader.result);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleRunStudentCsvImport = () => {
    const parsed = parseStudentsCSV(studentCsvText);
    if (parsed.students.length === 0) {
      setFeedback({
        type: 'err',
        text: parsed.errors[0] || 'Tidak ada baris siswa valid ditemukan di CSV.',
      });
      return;
    }
    const result = importStudentsBatch(parsed.students);
    setFilterClass('ALL');
    setSearch('');
    setFeedback({
      type: 'ok',
      text: `Import CSV siswa selesai: ${result.added} ditambahkan, ${result.updated} diperbarui${
        parsed.errors.length > 0 ? ` (${parsed.errors.length} baris dilewati)` : ''
      }.`,
    });
    setStudentCsvText('');
    setShowStudentCsvModal(false);
  };

  const handleTeacherCsvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setTeacherCsvText(reader.result);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleRunTeacherCsvImport = () => {
    const parsed = parseTeachersCSV(teacherCsvText);
    if (parsed.teachers.length === 0) {
      setFeedback({
        type: 'err',
        text: parsed.errors[0] || 'Tidak ada baris guru valid ditemukan di CSV.',
      });
      return;
    }
    const result = importTeachersBatch(parsed.teachers);
    setFeedback({
      type: 'ok',
      text: `Import CSV guru selesai: ${result.added} ditambahkan, ${result.updated} diperbarui.`,
    });
    setTeacherCsvText('');
    setShowTeacherCsvModal(false);
  };

  const handleSaveTeacher = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    if (!tUsername.trim() || !tName.trim() || !tPassword.trim()) {
      setFeedback({ type: 'err', text: 'Username, Nama Guru, dan Password wajib diisi.' });
      return;
    }
    const subjectsList = tSubjects
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    upsertTeacher({
      id: editingTeacherId || undefined,
      username: tUsername.trim(),
      nip: tNip.trim() || '-',
      name: tName.trim(),
      password: tPassword.trim(),
      subjects: subjectsList.length > 0 ? subjectsList : ['Umum'],
      classes: tClasses,
      active: true,
    });
    setFeedback({
      type: 'ok',
      text: editingTeacherId ? 'Akun guru berhasil diperbarui.' : 'Akun guru baru berhasil didaftarkan.',
    });
    setEditingTeacherId(null);
    setTUsername('');
    setTNip('');
    setTName('');
    setTPassword('');
    setTSubjects('');
    setTClasses([]);
  };

  const startEditTeacher = (t: TeacherAccount) => {
    setEditingTeacherId(t.id);
    setTUsername(t.username);
    setTNip(t.nip);
    setTName(t.name);
    setTPassword(t.password);
    setTSubjects(t.subjects.join(', '));
    setTClasses(t.classes);
    setFeedback(null);
  };

  const handleAddClass = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    const res = addClassRoom(newClassName);
    if (!res.ok) {
      setFeedback({ type: 'err', text: res.error || 'Gagal menambah kelas.' });
      return;
    }
    setNewClassName('');
    setFeedback({ type: 'ok', text: 'Kelas baru berhasil ditambahkan.' });
  };

  const handleSaveAdminAccount = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    if (!adminCurrentPass) {
      setFeedback({ type: 'err', text: 'Masukkan password saat ini untuk verifikasi perubahan.' });
      return;
    }
    const targetPassword = adminNewPass.trim() ? adminNewPass : db.adminAccount.password;
    if (adminNewPass.trim() && adminNewPass !== adminConfirmPass) {
      setFeedback({ type: 'err', text: 'Konfirmasi password baru tidak cocok.' });
      return;
    }
    const res = updateAdminAccount(adminCurrentPass, {
      displayName: adminDisplayName,
      username: adminUsername,
      password: targetPassword,
    });
    if (!res.ok) {
      setFeedback({ type: 'err', text: res.error || 'Gagal memperbarui akun Super Admin.' });
      return;
    }
    setAdminCurrentPass('');
    setAdminNewPass('');
    setAdminConfirmPass('');
    setFeedback({
      type: 'ok',
      text: 'Akun Super Admin berhasil diperbarui. Gunakan kredensial baru pada sesi login berikutnya.',
    });
  };

  const filteredStudents = db.students.filter((s) => {
    const matchClass = filterClass === 'ALL' || s.className === filterClass;
    const q = search.trim().toLowerCase();
    const matchQuery =
      !q ||
      s.name.toLowerCase().includes(q) ||
      s.nisn.toLowerCase().includes(q) ||
      s.className.toLowerCase().includes(q);
    return matchClass && matchQuery;
  });

  // Keep selections valid whenever records change
  const validSelectedStudentIds = selectedStudentIds.filter((id) =>
    filteredStudents.some((s) => s.id === id)
  );
  const allFilteredStudentsSelected =
    filteredStudents.length > 0 &&
    validSelectedStudentIds.length === filteredStudents.length;

  const validSelectedTeacherIds = selectedTeacherIds.filter((id) =>
    db.teachers.some((t) => t.id === id)
  );
  const allTeachersSelected =
    db.teachers.length > 0 && validSelectedTeacherIds.length === db.teachers.length;

  const validSelectedClassNames = selectedClassNames.filter((name) =>
    db.classes.includes(name)
  );
  const allClassesSelected =
    db.classes.length > 0 && validSelectedClassNames.length === db.classes.length;

  const toggleSelectStudent = (id: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
    setConfirmBulkDeleteStudents(false);
  };

  const toggleSelectAllStudents = () => {
    if (allFilteredStudentsSelected) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(filteredStudents.map((s) => s.id));
    }
    setConfirmBulkDeleteStudents(false);
  };

  const handleBulkBlockStudents = (active: boolean) => {
    if (validSelectedStudentIds.length === 0) return;
    const count = bulkSetStudentsActive(
      validSelectedStudentIds,
      active,
      active ? undefined : 'Diblokir massal oleh Administrator'
    );
    setConfirmBulkDeleteStudents(false);
    setFeedback({
      type: 'ok',
      text: active
        ? `${count} akun siswa terpilih berhasil diaktifkan kembali.`
        : `${count} akun siswa terpilih berhasil diblokir.`,
    });
  };

  const handleBulkDeleteStudentsConfirmed = () => {
    if (validSelectedStudentIds.length === 0) return;
    const removed = bulkDeleteStudents(validSelectedStudentIds);
    setSelectedStudentIds([]);
    setConfirmBulkDeleteStudents(false);
    setFeedback({
      type: 'ok',
      text: `${removed} data siswa terpilih berhasil dihapus dari database.`,
    });
  };

  const toggleSelectTeacher = (id: string) => {
    setSelectedTeacherIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
    setConfirmBulkDeleteTeachers(false);
  };

  const toggleSelectAllTeachers = () => {
    if (allTeachersSelected) {
      setSelectedTeacherIds([]);
    } else {
      setSelectedTeacherIds(db.teachers.map((t) => t.id));
    }
    setConfirmBulkDeleteTeachers(false);
  };

  const handleBulkBlockTeachers = (active: boolean) => {
    if (validSelectedTeacherIds.length === 0) return;
    const count = bulkSetTeachersActive(validSelectedTeacherIds, active);
    setConfirmBulkDeleteTeachers(false);
    setFeedback({
      type: 'ok',
      text: active
        ? `${count} akun guru terpilih berhasil diaktifkan kembali.`
        : `${count} akun guru terpilih berhasil diblokir.`,
    });
  };

  const handleBulkDeleteTeachersConfirmed = () => {
    if (validSelectedTeacherIds.length === 0) return;
    const removed = bulkDeleteTeachers(validSelectedTeacherIds);
    setSelectedTeacherIds([]);
    setConfirmBulkDeleteTeachers(false);
    setFeedback({
      type: 'ok',
      text: `${removed} akun guru terpilih berhasil dihapus.`,
    });
  };

  const toggleSelectClass = (cls: string) => {
    setSelectedClassNames((prev) =>
      prev.includes(cls) ? prev.filter((item) => item !== cls) : [...prev, cls]
    );
    setConfirmBulkDeleteClasses(false);
  };

  const toggleSelectAllClasses = () => {
    if (allClassesSelected) {
      setSelectedClassNames([]);
    } else {
      setSelectedClassNames([...db.classes]);
    }
    setConfirmBulkDeleteClasses(false);
  };

  const handleBulkDeleteClassesConfirmed = () => {
    if (validSelectedClassNames.length === 0) return;
    const removed = bulkDeleteClassRooms(validSelectedClassNames);
    setSelectedClassNames([]);
    setConfirmBulkDeleteClasses(false);
    setFeedback({
      type: 'ok',
      text: `${removed} kelas terpilih berhasil dihapus.`,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Manajemen Pengguna, Kelas & Akun Admin
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Kelola data siswa, akun guru, daftar kelas, serta kredensial Super Admin.
          </p>
        </div>

        {/* Segmented Sub-Tab Switcher */}
        <div className="inline-flex flex-wrap rounded-lg bg-slate-200/70 dark:bg-slate-800 p-1 self-start">
          <button
            type="button"
            onClick={() => {
              setSubTab('students');
              setFeedback(null);
            }}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
              subTab === 'students'
                ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            Data Siswa ({db.students.length})
          </button>
          <button
            type="button"
            onClick={() => {
              setSubTab('teachers');
              setFeedback(null);
            }}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
              subTab === 'teachers'
                ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            Data Guru ({db.teachers.length})
          </button>
          <button
            type="button"
            onClick={() => {
              setSubTab('classes');
              setFeedback(null);
            }}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
              subTab === 'classes'
                ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            Daftar Kelas ({db.classes.length})
          </button>
          <button
            type="button"
            onClick={() => {
              setSubTab('admin_account');
              setFeedback(null);
            }}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
              subTab === 'admin_account'
                ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            Akun Super Admin
          </button>
        </div>
      </div>

      {feedback && (
        <div
          role="status"
          className={`rounded-lg border px-4 py-3 text-xs font-medium ${
            feedback.type === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
              : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* STUDENTS TAB */}
      {subTab === 'students' && (
        <div className="space-y-6">
          <form
            onSubmit={handleSaveStudent}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {editingStudentId ? 'Edit Data Siswa' : 'Tambah Siswa Manual'}
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    downloadTextFile('format-import-siswa.csv', generateStudentsCSVTemplate());
                    setFeedback({ type: 'ok', text: 'Template format-import-siswa.csv berhasil diunduh.' });
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 whitespace-nowrap"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download Format CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowStudentCsvModal((v) => !v)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/50 px-3 py-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 whitespace-nowrap"
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span>Import Massal CSV</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <div>
                <label htmlFor="adm-stu-nisn" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  NISN
                </label>
                <input
                  id="adm-stu-nisn"
                  type="text"
                  value={stuNisn}
                  onChange={(e) => setStuNisn(e.target.value)}
                  placeholder="0081234567"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs font-mono focus:border-indigo-600 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="adm-stu-name" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Nama Lengkap
                </label>
                <input
                  id="adm-stu-name"
                  type="text"
                  value={stuName}
                  onChange={(e) => setStuName(e.target.value)}
                  placeholder="Nama lengkap siswa"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs focus:border-indigo-600 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="adm-stu-class" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Kelas
                </label>
                {db.classes.length > 0 ? (
                  <select
                    id="adm-stu-class"
                    value={stuClass}
                    onChange={(e) => setStuClass(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs focus:border-indigo-600 focus:outline-none"
                  >
                    {db.classes.map((cls) => (
                      <option key={cls} value={cls}>
                        {cls}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id="adm-stu-class"
                    type="text"
                    value={stuClass}
                    onChange={(e) => setStuClass(e.target.value)}
                    placeholder="Contoh: X-IPA-1"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs font-mono uppercase focus:border-indigo-600 focus:outline-none"
                  />
                )}
              </div>
              <div className="flex items-end gap-2">
                <button
                  type="submit"
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-700 whitespace-nowrap"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  <span>{editingStudentId ? 'Simpan Perubahan' : 'Tambah Siswa'}</span>
                </button>
                {editingStudentId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingStudentId(null);
                      setStuNisn('');
                      setStuName('');
                    }}
                    className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50"
                  >
                    Batal
                  </button>
                )}
              </div>
            </div>
          </form>

          {/* Student CSV Bulk Import Panel */}
          {showStudentCsvModal && (
            <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/40 dark:bg-indigo-950/30 p-5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Import Massal Data Siswa (CSV)
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Format kolom: <code className="font-mono">NISN,Nama,Kelas,Status_Aktif</code> (Aktif / Blokir)
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      downloadTextFile('format-import-siswa.csv', generateStudentsCSVTemplate())
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Unduh Template .CSV</span>
                  </button>
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50">
                    <Upload className="h-3.5 w-3.5" />
                    <span>Unggah File .CSV</span>
                    <input
                      type="file"
                      accept=".csv,.txt"
                      onChange={handleStudentCsvFileChange}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
              <textarea
                rows={5}
                value={studentCsvText}
                onChange={(e) => setStudentCsvText(e.target.value)}
                placeholder={'NISN,Nama,Kelas,Status_Aktif\n0081234567,Nama Siswa,X-IPA-1,Aktif'}
                aria-label="Konten CSV siswa"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 p-3 font-mono text-xs text-slate-800 dark:text-slate-100 focus:border-indigo-600 focus:outline-none"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowStudentCsvModal(false)}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  onClick={handleRunStudentCsvImport}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
                >
                  Proses Import CSV
                </button>
              </div>
            </div>
          )}

          {/* Student Table */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-800">
              <div className="relative flex-1 max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari nama atau NISN siswa..."
                  aria-label="Cari siswa"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 pl-9 pr-3 py-2 text-xs focus:border-indigo-600 focus:outline-none"
                />
              </div>
              <select
                value={filterClass}
                onChange={(e) => setFilterClass(e.target.value)}
                aria-label="Filter berdasarkan kelas"
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs text-slate-700 dark:text-slate-200"
              >
                <option value="ALL">Semua Kelas</option>
                {db.classes.map((cls) => (
                  <option key={cls} value={cls}>
                    Kelas {cls}
                  </option>
                ))}
              </select>
            </div>

            {/* Bulk Selection & Action Bar for Students */}
            {filteredStudents.length > 0 && (
              <div
                data-testid="student-bulk-bar"
                className={`flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-slate-100 dark:border-slate-800 transition-colors ${
                  validSelectedStudentIds.length > 0
                    ? 'bg-indigo-50/70 dark:bg-indigo-950/35'
                    : 'bg-slate-50/60 dark:bg-slate-800/30'
                }`}
              >
                <div className="flex items-center gap-3">
                  <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200 select-none">
                    <input
                      type="checkbox"
                      checked={allFilteredStudentsSelected}
                      onChange={toggleSelectAllStudents}
                      aria-label="Tandai Semua Siswa"
                      className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Tandai Semua</span>
                  </label>
                  <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    {validSelectedStudentIds.length > 0
                      ? `${validSelectedStudentIds.length} dari ${filteredStudents.length} siswa ditandai`
                      : `${filteredStudents.length} siswa ditampilkan`}
                  </span>
                </div>

                {validSelectedStudentIds.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleBulkBlockStudents(false)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/50 px-3 py-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-950/80 whitespace-nowrap"
                    >
                      <Ban className="h-3.5 w-3.5" />
                      <span>Blokir Terpilih ({validSelectedStudentIds.length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBulkBlockStudents(true)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/50 px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-950/80 whitespace-nowrap"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Aktifkan Terpilih</span>
                    </button>
                    {confirmBulkDeleteStudents ? (
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={handleBulkDeleteStudentsConfirmed}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 whitespace-nowrap"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Konfirmasi Hapus ({validSelectedStudentIds.length})</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmBulkDeleteStudents(false)}
                          className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300"
                        >
                          Batal
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmBulkDeleteStudents(true)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 dark:border-rose-700 bg-rose-50 dark:bg-rose-950/50 px-3 py-1.5 text-xs font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-950/80 whitespace-nowrap"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Hapus Terpilih ({validSelectedStudentIds.length})</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="w-10 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={allFilteredStudentsSelected}
                        disabled={filteredStudents.length === 0}
                        onChange={toggleSelectAllStudents}
                        aria-label="Pilih semua siswa pada tabel"
                        className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500"
                      />
                    </th>
                    <th className="px-4 py-3 font-semibold">NISN</th>
                    <th className="px-4 py-3 font-semibold">Nama Lengkap</th>
                    <th className="px-4 py-3 font-semibold">Kelas</th>
                    <th className="px-4 py-3 font-semibold">Status Akses</th>
                    <th className="px-4 py-3 font-semibold text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredStudents.map((s) => {
                    const isChecked = validSelectedStudentIds.includes(s.id);
                    return (
                      <tr
                        key={s.id}
                        className={`transition-colors ${
                          isChecked
                            ? 'bg-indigo-50/50 dark:bg-indigo-950/25'
                            : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/40'
                        }`}
                      >
                        <td className="w-10 px-4 py-3">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSelectStudent(s.id)}
                            aria-label={`Tandai siswa ${s.name}`}
                            className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500"
                          />
                        </td>
                        <td className="px-4 py-3 font-mono font-medium text-slate-700 dark:text-slate-300 tabular-nums">
                          {s.nisn}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">
                          {s.name}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{s.className}</td>
                        <td className="px-4 py-3">
                          {s.active ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Aktif
                            </span>
                          ) : (
                            <div>
                              <span className="inline-flex items-center gap-1 font-semibold text-rose-700 dark:text-rose-400">
                                <Ban className="h-3.5 w-3.5" />
                                Diblokir
                              </span>
                              {s.blockReason && (
                                <p className="text-[11px] text-slate-500">{s.blockReason}</p>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => startEditStudent(s)}
                              aria-label={`Edit siswa ${s.name}`}
                              className="rounded-md border border-slate-200 dark:border-slate-700 px-2 py-1 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                toggleStudentActive(
                                  s.id,
                                  s.active ? 'Kendala administrasi ujian' : undefined
                                )
                              }
                              className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${
                                s.active
                                  ? 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                                  : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                              }`}
                            >
                              {s.active ? 'Blokir' : 'Aktifkan'}
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteStudent(s.id)}
                              aria-label={`Hapus siswa ${s.name}`}
                              className="rounded-md border border-rose-200 px-2 py-1 text-rose-600 hover:bg-rose-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredStudents.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-slate-500 dark:text-slate-400">
                        {db.students.length === 0
                          ? 'Belum ada data siswa. Silakan tambahkan secara manual atau unggah melalui Import Massal CSV.'
                          : 'Tidak ada data siswa yang cocok dengan filter pencarian.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TEACHERS TAB */}
      {subTab === 'teachers' && (
        <div className="space-y-6">
          <form
            onSubmit={handleSaveTeacher}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {editingTeacherId ? 'Edit Akun Guru' : 'Daftarkan Akun Guru Baru'}
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    downloadTextFile('format-import-guru.csv', generateTeachersCSVTemplate());
                    setFeedback({ type: 'ok', text: 'Template format-import-guru.csv berhasil diunduh.' });
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 whitespace-nowrap"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download Format CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowTeacherCsvModal((v) => !v)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/50 px-3 py-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 whitespace-nowrap"
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span>Import Massal CSV</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label htmlFor="t-name" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Nama Lengkap & Gelar
                </label>
                <input
                  id="t-name"
                  type="text"
                  value={tName}
                  onChange={(e) => setTName(e.target.value)}
                  placeholder="Nama lengkap guru"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs focus:border-indigo-600 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="t-user" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Username Login
                </label>
                <input
                  id="t-user"
                  type="text"
                  value={tUsername}
                  onChange={(e) => setTUsername(e.target.value)}
                  placeholder="Username guru"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs font-mono focus:border-indigo-600 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="t-nip" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  NIP
                </label>
                <input
                  id="t-nip"
                  type="text"
                  value={tNip}
                  onChange={(e) => setTNip(e.target.value)}
                  placeholder="Nomor Induk Pegawai"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs font-mono focus:border-indigo-600 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="t-pass" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Password
                </label>
                <input
                  id="t-pass"
                  type="text"
                  value={tPassword}
                  onChange={(e) => setTPassword(e.target.value)}
                  placeholder="Password akun guru"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs font-mono focus:border-indigo-600 focus:outline-none"
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="t-subj" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Mata Pelajaran Diampu (pisahkan dengan koma)
                </label>
                <input
                  id="t-subj"
                  type="text"
                  value={tSubjects}
                  onChange={(e) => setTSubjects(e.target.value)}
                  placeholder="Fisika, Kimia, Biologi"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs focus:border-indigo-600 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                Kelas yang Diampu
              </p>
              {db.classes.length === 0 ? (
                <p className="text-xs text-slate-500">
                  Belum ada daftar kelas. Tambahkan kelas pada tab Daftar Kelas terlebih dahulu.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {db.classes.map((cls) => {
                    const selected = tClasses.includes(cls);
                    return (
                      <button
                        key={cls}
                        type="button"
                        onClick={() =>
                          setTClasses((prev) =>
                            selected ? prev.filter((c) => c !== cls) : [...prev, cls]
                          )
                        }
                        className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                          selected
                            ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        {cls}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
              >
                {editingTeacherId ? 'Simpan Perubahan Guru' : 'Simpan Akun Guru'}
              </button>
              {editingTeacherId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingTeacherId(null);
                    setTUsername('');
                    setTNip('');
                    setTName('');
                    setTPassword('');
                    setTSubjects('');
                    setTClasses([]);
                  }}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  Batal
                </button>
              )}
            </div>
          </form>

          {/* Teacher CSV Import Panel */}
          {showTeacherCsvModal && (
            <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/40 dark:bg-indigo-950/30 p-5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Import Massal Data Guru (CSV)
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Format: <code className="font-mono">Username,NIP,Nama,Password,Mapel,Kelas</code> (pisahkan beberapa mapel/kelas dengan titik koma <code className="font-mono">;</code>)
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      downloadTextFile('format-import-guru.csv', generateTeachersCSVTemplate())
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Unduh Template .CSV</span>
                  </button>
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
                    <Upload className="h-3.5 w-3.5" />
                    <span>Unggah File .CSV</span>
                    <input
                      type="file"
                      accept=".csv,.txt"
                      onChange={handleTeacherCsvFileChange}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
              <textarea
                rows={4}
                value={teacherCsvText}
                onChange={(e) => setTeacherCsvText(e.target.value)}
                placeholder="Username,NIP,Nama,Password,Mapel,Kelas"
                aria-label="Konten CSV guru"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 p-3 font-mono text-xs text-slate-800 dark:text-slate-100"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowTeacherCsvModal(false)}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-medium"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  onClick={handleRunTeacherCsvImport}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
                >
                  Proses Import Guru
                </button>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
            {/* Bulk Selection & Action Bar for Teachers */}
            {db.teachers.length > 0 && (
              <div
                data-testid="teacher-bulk-bar"
                className={`flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-slate-100 dark:border-slate-800 transition-colors ${
                  validSelectedTeacherIds.length > 0
                    ? 'bg-indigo-50/70 dark:bg-indigo-950/35'
                    : 'bg-slate-50/60 dark:bg-slate-800/30'
                }`}
              >
                <div className="flex items-center gap-3">
                  <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200 select-none">
                    <input
                      type="checkbox"
                      checked={allTeachersSelected}
                      onChange={toggleSelectAllTeachers}
                      aria-label="Tandai Semua Guru"
                      className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Tandai Semua</span>
                  </label>
                  <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    {validSelectedTeacherIds.length > 0
                      ? `${validSelectedTeacherIds.length} dari ${db.teachers.length} guru ditandai`
                      : `${db.teachers.length} akun guru terdaftar`}
                  </span>
                </div>

                {validSelectedTeacherIds.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleBulkBlockTeachers(false)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/50 px-3 py-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300 hover:bg-amber-100 whitespace-nowrap"
                    >
                      <Ban className="h-3.5 w-3.5" />
                      <span>Blokir Terpilih ({validSelectedTeacherIds.length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBulkBlockTeachers(true)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/50 px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 whitespace-nowrap"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Aktifkan Terpilih</span>
                    </button>
                    {confirmBulkDeleteTeachers ? (
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={handleBulkDeleteTeachersConfirmed}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 whitespace-nowrap"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Konfirmasi Hapus ({validSelectedTeacherIds.length})</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmBulkDeleteTeachers(false)}
                          className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300"
                        >
                          Batal
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmBulkDeleteTeachers(true)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 dark:border-rose-700 bg-rose-50 dark:bg-rose-950/50 px-3 py-1.5 text-xs font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-100 whitespace-nowrap"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Hapus Terpilih ({validSelectedTeacherIds.length})</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="w-10 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={allTeachersSelected}
                        disabled={db.teachers.length === 0}
                        onChange={toggleSelectAllTeachers}
                        aria-label="Pilih semua guru pada tabel"
                        className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500"
                      />
                    </th>
                    <th className="px-4 py-3 font-semibold">Nama Guru</th>
                    <th className="px-4 py-3 font-semibold">Username / NIP</th>
                    <th className="px-4 py-3 font-semibold">Mata Pelajaran</th>
                    <th className="px-4 py-3 font-semibold">Kelas Ampuan</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {db.teachers.map((t) => {
                    const isChecked = validSelectedTeacherIds.includes(t.id);
                    return (
                      <tr
                        key={t.id}
                        className={`transition-colors ${
                          isChecked
                            ? 'bg-indigo-50/50 dark:bg-indigo-950/25'
                            : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/40'
                        }`}
                      >
                        <td className="w-10 px-4 py-3">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSelectTeacher(t.id)}
                            aria-label={`Tandai guru ${t.name}`}
                            className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500"
                          />
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">{t.name}</td>
                        <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-400">
                          <div>{t.username}</div>
                          <div className="text-[11px] text-slate-400">NIP {t.nip}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{t.subjects.join(' · ')}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                          {t.classes.length > 0 ? t.classes.join(', ') : '-'}
                        </td>
                        <td className="px-4 py-3">
                          {t.active ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Aktif
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 font-semibold text-rose-700 dark:text-rose-400">
                              <Ban className="h-3.5 w-3.5" />
                              Diblokir
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => startEditTeacher(t)}
                              aria-label={`Edit guru ${t.name}`}
                              className="rounded-md border border-slate-200 dark:border-slate-700 px-2 py-1 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleTeacherActive(t.id)}
                              className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${
                                t.active
                                  ? 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                                  : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                              }`}
                            >
                              {t.active ? 'Blokir' : 'Aktifkan'}
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteTeacher(t.id)}
                              aria-label={`Hapus guru ${t.name}`}
                              className="rounded-md border border-rose-200 px-2 py-1 text-rose-600 hover:bg-rose-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {db.teachers.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-slate-500 dark:text-slate-400">
                        Belum ada data guru terdaftar. Tambahkan akun guru di atas atau melalui Import Massal CSV.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* CLASSES TAB */}
      {subTab === 'classes' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <form
            onSubmit={handleAddClass}
            className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4 self-start"
          >
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Tambah Kelas Baru
            </h2>
            <div>
              <label htmlFor="new-class-input" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Kode / Nama Kelas
              </label>
              <input
                id="new-class-input"
                type="text"
                value={newClassName}
                onChange={(e) => setNewClassName(e.target.value)}
                placeholder="Contoh: X-IPA-1 atau XII-IPS-2"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs uppercase font-mono focus:border-indigo-600 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Tambahkan Kelas</span>
            </button>
          </form>

          <div className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                {db.classes.length > 0 && (
                  <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200 select-none">
                    <input
                      type="checkbox"
                      checked={allClassesSelected}
                      onChange={toggleSelectAllClasses}
                      aria-label="Tandai Semua Kelas"
                      className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Tandai Semua</span>
                  </label>
                )}
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Daftar Kelas Terdaftar
                </h2>
              </div>

              {validSelectedClassNames.length > 0 && (
                <div className="flex items-center gap-1.5">
                  {confirmBulkDeleteClasses ? (
                    <>
                      <button
                        type="button"
                        onClick={handleBulkDeleteClassesConfirmed}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 whitespace-nowrap"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Konfirmasi Hapus ({validSelectedClassNames.length})</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmBulkDeleteClasses(false)}
                        className="rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300"
                      >
                        Batal
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmBulkDeleteClasses(true)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 dark:border-rose-700 bg-rose-50 dark:bg-rose-950/50 px-3 py-1.5 text-xs font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-100 whitespace-nowrap"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Hapus Terpilih ({validSelectedClassNames.length})</span>
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {db.classes.map((cls) => {
                const count = db.students.filter((s) => s.className === cls).length;
                const isChecked = validSelectedClassNames.includes(cls);
                return (
                  <div
                    key={cls}
                    className={`flex items-center justify-between px-5 py-3.5 transition-colors ${
                      isChecked
                        ? 'bg-indigo-50/50 dark:bg-indigo-950/25'
                        : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <label className="flex cursor-pointer items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleSelectClass(cls)}
                        aria-label={`Tandai kelas ${cls}`}
                        className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 font-mono">
                          {cls}
                        </span>
                        <span className="ml-3 text-xs text-slate-500 tabular-nums">
                          {count} siswa terdaftar
                        </span>
                      </div>
                    </label>
                    <button
                      type="button"
                      onClick={() => deleteClassRoom(cls)}
                      aria-label={`Hapus kelas ${cls}`}
                      className="rounded-md border border-rose-200 px-2.5 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50"
                    >
                      Hapus
                    </button>
                  </div>
                );
              })}
              {db.classes.length === 0 && (
                <div className="px-5 py-10 text-center text-xs text-slate-500 dark:text-slate-400">
                  Belum ada daftar kelas. Tambahkan kelas baru menggunakan formulir di samping.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* EDIT SUPER ADMIN ACCOUNT TAB */}
      {subTab === 'admin_account' && (
        <form
          onSubmit={handleSaveAdminAccount}
          className="max-w-xl rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5"
        >
          <div className="flex items-start gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
            <KeyRound className="h-5 w-5 text-indigo-600 dark:text-indigo-400 mt-0.5 shrink-0" />
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Edit Akun Super Admin
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Perbarui nama tampilan, username, atau password akses administrator pusat.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label htmlFor="adm-display" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Nama Tampilan Administrator
              </label>
              <input
                id="adm-display"
                type="text"
                value={adminDisplayName}
                onChange={(e) => setAdminDisplayName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2 text-xs focus:border-indigo-600 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="adm-username" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Username Super Admin
              </label>
              <input
                id="adm-username"
                type="text"
                value={adminUsername}
                onChange={(e) => setAdminUsername(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2 text-xs font-mono focus:border-indigo-600 focus:outline-none"
              />
            </div>

            <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-3">
              <div>
                <label htmlFor="adm-cur-pass" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Password Saat Ini (Wajib untuk konfirmasi)
                </label>
                <input
                  id="adm-cur-pass"
                  type="password"
                  value={adminCurrentPass}
                  onChange={(e) => setAdminCurrentPass(e.target.value)}
                  placeholder="Masukkan password saat ini"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2 text-xs focus:border-indigo-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="adm-new-pass" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Password Baru (Opsional)
                  </label>
                  <input
                    id="adm-new-pass"
                    type="password"
                    value={adminNewPass}
                    onChange={(e) => setAdminNewPass(e.target.value)}
                    placeholder="Kosongkan jika tidak diubah"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2 text-xs focus:border-indigo-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="adm-confirm-pass" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Konfirmasi Password Baru
                  </label>
                  <input
                    id="adm-confirm-pass"
                    type="password"
                    value={adminConfirmPass}
                    onChange={(e) => setAdminConfirmPass(e.target.value)}
                    placeholder="Ulangi password baru"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2 text-xs focus:border-indigo-600 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="rounded-lg bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-indigo-700"
          >
            Simpan Perubahan Akun Super Admin
          </button>
        </form>
      )}
    </div>
  );
}
