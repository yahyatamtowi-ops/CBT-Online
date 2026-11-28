import React, { useEffect, useState } from 'react';
import {
  Building2,
  Camera,
  Edit3,
  Moon,
  Palette,
  Plus,
  Save,
  ShieldCheck,
  Sun,
  Trash2,
  Upload,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { useCBT } from '../../context/CBTContext';
import type { ProctorAccount, ThemeAccent, ThemeMode } from '../../types/cbt';
import { SchoolLogo } from '../LandingPortal';

const THEME_ACCENTS: Array<{
  id: ThemeAccent;
  label: string;
  swatch: string;
}> = [
  { id: 'indigo', label: 'Indigo Profesional', swatch: '#4f46e5' },
  { id: 'blue', label: 'Biru Nusantara', swatch: '#2563eb' },
  { id: 'emerald', label: 'Hijau Zamrud', swatch: '#059669' },
  { id: 'amber', label: 'Emas Kabun', swatch: '#d97706' },
  { id: 'teal', label: 'Teal Modern', swatch: '#0d9488' },
  { id: 'rose', label: 'Merah Marun', swatch: '#e11d48' },
];

interface ProctorFormState {
  id?: string;
  name: string;
  username: string;
  password: string;
  nip: string;
  assignedPackageIds: string[];
  assignedClasses: string[];
  active: boolean;
}

const EMPTY_PROCTOR_FORM: ProctorFormState = {
  name: '',
  username: '',
  password: '',
  nip: '',
  assignedPackageIds: [],
  assignedClasses: [],
  active: true,
};

type SettingsSubTab = 'security' | 'proctor' | 'theme' | 'identity';

export function GlobalSecuritySettings() {
  const {
    db,
    updateSecurityConfig,
    updateSchoolIdentity,
    updateThemeConfig,
    updateProctorConfig,
    upsertProctor,
    toggleProctorActive,
    deleteProctor,
  } = useCBT();
  const [activeSubTab, setActiveSubTab] = useState<SettingsSubTab>('security');
  const [schoolForm, setSchoolForm] = useState(db.school);
  const [notice, setNotice] = useState<string | null>(null);
  const [proctorForm, setProctorForm] = useState<ProctorFormState>(EMPTY_PROCTOR_FORM);
  const [editingTeacherAssignId, setEditingTeacherAssignId] = useState<string | null>(null);

  useEffect(() => {
    setSchoolForm(db.school);
  }, [db.school]);

  const sec = db.security;

  const toggleSecurityField = (
    key:
      | 'requireFullscreen'
      | 'requireCameraMonitoring'
      | 'detectTabSwitchAndSplitScreen'
      | 'detectNotificationBarAndScreenshot'
      | 'blockRightClickAndCopyPaste'
      | 'enableDynamicWatermark'
      | 'showScoreAndExplanationAuto'
  ) => {
    const currentVal =
      key === 'detectNotificationBarAndScreenshot'
        ? sec.detectNotificationBarAndScreenshot !== false
        : Boolean(sec[key]);
    updateSecurityConfig({ ...sec, [key]: !currentVal });
    setNotice('Kebijakan keamanan global diperbarui secara dinamis.');
  };

  const handleToleranceChange = (value: number) => {
    updateSecurityConfig({ ...sec, maxViolationTolerance: value });
    setNotice(`Batas toleransi pelanggaran diubah menjadi ${value}x peringatan.`);
  };

  const handleThemeMode = (mode: ThemeMode) => {
    updateThemeConfig({ ...db.theme, mode });
    setNotice(`Mode tampilan diubah ke ${mode === 'dark' ? 'Mode Gelap' : 'Mode Terang'}.`);
  };

  const handleThemeAccent = (accent: ThemeAccent) => {
    updateThemeConfig({ ...db.theme, accent });
    const label = THEME_ACCENTS.find((a) => a.id === accent)?.label || accent;
    setNotice(`Warna tema utama diubah ke ${label}.`);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setSchoolForm((prev) => ({ ...prev, logoUrl: reader.result as string }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveSchool = (e: React.FormEvent) => {
    e.preventDefault();
    if (!schoolForm.schoolName.trim()) {
      setNotice('Nama sekolah tidak boleh kosong.');
      return;
    }
    updateSchoolIdentity(schoolForm);
    setNotice('Identitas sekolah dan pengumuman halaman depan berhasil disimpan.');
  };

  const proctorConfig = db.proctorConfig || {
    enabled: true,
    allowTeacherAccountsAsProctor: true,
    teacherAssignments: {},
  };
  const proctors = db.proctors || [];
  const allClassNames = db.classes || [];

  const handleToggleProctorMode = () => {
    const nextEnabled = !proctorConfig.enabled;
    updateProctorConfig({ ...proctorConfig, enabled: nextEnabled });
    setNotice(
      nextEnabled
        ? 'Mode Pengawas Ujian diaktifkan. Tombol Login Pengawas tampil di halaman depan.'
        : 'Mode Pengawas Ujian dinonaktifkan. Ujian berlangsung tanpa portal pengawas.'
    );
  };

  const handleToggleTeacherAsProctor = () => {
    const nextAllow = !proctorConfig.allowTeacherAccountsAsProctor;
    updateProctorConfig({
      ...proctorConfig,
      allowTeacherAccountsAsProctor: nextAllow,
    });
    setNotice(
      nextAllow
        ? 'Akun Guru kini diizinkan login melalui Portal Pengawas.'
        : 'Hanya akun Pengawas khusus yang dapat login ke Portal Pengawas.'
    );
  };

  const toggleProctorFormPackage = (pkgId: string) => {
    setProctorForm((prev) => ({
      ...prev,
      assignedPackageIds: prev.assignedPackageIds.includes(pkgId)
        ? prev.assignedPackageIds.filter((id) => id !== pkgId)
        : [...prev.assignedPackageIds, pkgId],
    }));
  };

  const toggleProctorFormClass = (className: string) => {
    setProctorForm((prev) => ({
      ...prev,
      assignedClasses: prev.assignedClasses.includes(className)
        ? prev.assignedClasses.filter((c) => c !== className)
        : [...prev.assignedClasses, className],
    }));
  };

  const handleSaveProctor = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = proctorForm.name.trim();
    const cleanUsername = proctorForm.username.trim();
    const cleanPassword = proctorForm.password.trim();
    if (!cleanName || !cleanUsername || !cleanPassword) {
      setNotice('Nama, username, dan password akun pengawas wajib diisi.');
      return;
    }
    const duplicate = proctors.find(
      (p) =>
        p.id !== proctorForm.id &&
        p.username.trim().toLowerCase() === cleanUsername.toLowerCase()
    );
    if (duplicate) {
      setNotice(`Username "${cleanUsername}" sudah digunakan oleh pengawas lain.`);
      return;
    }
    upsertProctor({
      id: proctorForm.id,
      name: cleanName,
      username: cleanUsername,
      password: cleanPassword,
      nip: proctorForm.nip.trim() || undefined,
      assignedPackageIds: proctorForm.assignedPackageIds,
      assignedClasses: proctorForm.assignedClasses,
      active: proctorForm.active,
    });
    setNotice(
      proctorForm.id
        ? `Akun pengawas ${cleanName} berhasil diperbarui.`
        : `Akun pengawas ${cleanName} berhasil ditambahkan.`
    );
    setProctorForm(EMPTY_PROCTOR_FORM);
  };

  const handleEditProctor = (account: ProctorAccount) => {
    setProctorForm({
      id: account.id,
      name: account.name,
      username: account.username,
      password: account.password,
      nip: account.nip || '',
      assignedPackageIds: [...(account.assignedPackageIds || [])],
      assignedClasses: [...(account.assignedClasses || [])],
      active: account.active,
    });
  };

  const handleToggleTeacherAssignmentItem = (
    teacherId: string,
    field: 'assignedPackageIds' | 'assignedClasses',
    value: string
  ) => {
    const current = proctorConfig.teacherAssignments?.[teacherId] || {
      assignedPackageIds: [],
      assignedClasses: [],
    };
    const list = current[field] || [];
    const nextList = list.includes(value)
      ? list.filter((item) => item !== value)
      : [...list, value];
    updateProctorConfig({
      ...proctorConfig,
      teacherAssignments: {
        ...(proctorConfig.teacherAssignments || {}),
        [teacherId]: {
          ...current,
          [field]: nextList,
        },
      },
    });
    setNotice('Penugasan kelas/paket pengawas untuk akun guru diperbarui.');
  };

  const toggles: Array<{
    key:
      | 'requireFullscreen'
      | 'requireCameraMonitoring'
      | 'detectTabSwitchAndSplitScreen'
      | 'detectNotificationBarAndScreenshot'
      | 'blockRightClickAndCopyPaste'
      | 'enableDynamicWatermark'
      | 'showScoreAndExplanationAuto';
    title: string;
    description: string;
    highlightCamera?: boolean;
  }> = [
    {
      key: 'requireCameraMonitoring',
      title: 'Kamera, Jangkauan Wajah & Deteksi Mengobrol',
      description:
        'Pantau wajah keluar dari jangkauan kamera, >1 wajah, dan suara mengobrol (gerakan wajar di depan kamera tidak memicu pelanggaran). Teguran suara otomatis.',
      highlightCamera: true,
    },
    {
      key: 'requireFullscreen',
      title: 'Wajib Layar Penuh (Fullscreen)',
      description:
        'Mengunci layar ujian ke mode penuh; keluar dari fullscreen langsung memicu peringatan & pelanggaran.',
    },
    {
      key: 'detectTabSwitchAndSplitScreen',
      title: 'Deteksi Pindah Tab, Blur & Split Screen',
      description:
        'Mendeteksi perpindahan tab, kehilangan fokus jendela, dan split screen / floating window HP.',
    },
    {
      key: 'detectNotificationBarAndScreenshot',
      title: 'Larangan Bilah Notifikasi & Proteksi Screenshot',
      description:
        'Blokir tarikan bilah notifikasi HP/tablet serta langsung tutup layar saat terdeteksi tangkapan layar.',
    },
    {
      key: 'blockRightClickAndCopyPaste',
      title: 'Blokir Klik Kanan, Copy-Paste & DevTools',
      description:
        'Menonaktifkan klik kanan, seleksi teks, drag-drop, Ctrl+C/V/X/P/S/U, dan F12/DevTools.',
    },
    {
      key: 'enableDynamicWatermark',
      title: 'Watermark Dinamis Anti-Foto Layar',
      description:
        'Teks transparan NISN, Nama, dan Waktu melayang di latar soal untuk mencegah pemotretan layar.',
    },
    {
      key: 'showScoreAndExplanationAuto',
      title: 'Tampilkan Nilai & Pembahasan Otomatis',
      description:
        'Nilai akhir, status KKM, dan pembahasan langsung tampil setelah ujian dikumpulkan.',
    },
  ];

  const settingsSubTabs: Array<{
    id: SettingsSubTab;
    label: string;
    shortLabel: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { id: 'security', label: 'Keamanan Anti-Curang', shortLabel: 'Keamanan', icon: ShieldCheck },
    { id: 'proctor', label: 'Pengawas Ujian', shortLabel: 'Pengawas', icon: UserCheck },
    { id: 'theme', label: 'Tema & Warna', shortLabel: 'Tema', icon: Palette },
    { id: 'identity', label: 'Identitas Sekolah', shortLabel: 'Identitas', icon: Building2 },
  ];

  return (
    <div className="space-y-3.5 sm:space-y-5">
      <div>
        <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Keamanan, Tema & Identitas Sekolah
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Pilih sub menu di bawah untuk mengatur keamanan, pengawas, tema, atau identitas sekolah secara ringkas.
        </p>
      </div>

      {/* Compact Sub-Menu Bar */}
      <div
        role="tablist"
        aria-label="Sub Menu Keamanan, Tema & Identitas"
        className="grid grid-cols-4 sm:inline-flex gap-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1 w-full sm:w-auto"
      >
        {settingsSubTabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              data-testid={`settings-subtab-${tab.id}`}
              onClick={() => setActiveSubTab(tab.id)}
              className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 sm:px-3.5 sm:py-2 text-[11px] sm:text-xs font-semibold transition-colors whitespace-nowrap ${
                active
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="sm:hidden truncate">{tab.shortLabel}</span>
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {notice && (
        <div
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40 px-3.5 py-2.5 text-xs font-medium text-emerald-800 dark:text-emerald-300"
        >
          {notice}
        </div>
      )}

      {/* SUB-MENU 3: PENGATURAN TEMA APLIKASI */}
      {activeSubTab === 'theme' && (
        <section
          data-testid="settings-panel-theme"
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 sm:p-6 space-y-3.5 sm:space-y-5"
        >
        <div className="flex items-start gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
          <Palette className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-600 dark:text-indigo-400 mt-0.5 shrink-0" />
          <div>
            <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
              Tema & Warna Aplikasi
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Mode terang/gelap dan warna aksen utama portal.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-12">
          <div className="lg:col-span-4 space-y-2.5">
            <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Mode Tampilan
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleThemeMode('light')}
                className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-semibold transition-colors ${
                  db.theme.mode === 'light'
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <Sun className="h-4 w-4" />
                <span>Terang</span>
              </button>
              <button
                type="button"
                onClick={() => handleThemeMode('dark')}
                className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-semibold transition-colors ${
                  db.theme.mode === 'dark'
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <Moon className="h-4 w-4" />
                <span>Gelap</span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-8 space-y-2.5">
            <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Warna Aksen Utama
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {THEME_ACCENTS.map((item) => {
                const selected = db.theme.accent === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleThemeAccent(item.id)}
                    className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-xs font-semibold transition-colors ${
                      selected
                        ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/50 text-slate-900 dark:text-slate-100 ring-1 ring-indigo-600/20'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span
                      className="h-4 w-4 rounded-full shrink-0 border border-black/10"
                      style={{ backgroundColor: item.swatch }}
                    />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        </section>
      )}

      {/* SUB-MENU 1: SAKELAR KEAMANAN ANTI-CURANG */}
      {activeSubTab === 'security' && (
        <section
          data-testid="settings-panel-security"
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 sm:p-6 space-y-4 sm:space-y-5"
        >
          <div className="flex items-start gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
            <ShieldCheck className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-600 dark:text-indigo-400 mt-0.5 shrink-0" />
            <div>
              <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
                Sakelar Keamanan Anti-Curang
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Perubahan langsung berlaku real-time di sesi ujian siswa.
              </p>
            </div>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {toggles.map((item) => {
              const checked =
                item.key === 'detectNotificationBarAndScreenshot'
                  ? sec.detectNotificationBarAndScreenshot !== false
                  : Boolean(sec[item.key]);
              return (
                <div
                  key={item.key}
                  className="flex items-start justify-between gap-3 py-3 sm:py-4 first:pt-0 last:pb-0"
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900 dark:text-slate-100">
                      {item.highlightCamera && (
                        <Camera className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      )}
                      <span>{item.title}</span>
                    </div>
                    <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 leading-snug sm:leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={checked}
                    aria-label={item.title}
                    onClick={() => toggleSecurityField(item.key)}
                    className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                      checked ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                        checked ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Violation Tolerance Selector */}
          <div className="border-t border-slate-200 dark:border-slate-800 pt-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  Batas Toleransi Pelanggaran Global
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Ujian akan dikunci otomatis setelah pelanggaran melebihi jumlah peringatan ini.
                </p>
              </div>
              <span className="font-mono text-sm font-bold text-rose-700 dark:text-rose-400 tabular-nums">
                {sec.maxViolationTolerance}x Peringatan
              </span>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleToleranceChange(num)}
                  className={`rounded-lg border py-2 text-xs font-mono font-semibold transition-colors ${
                    sec.maxViolationTolerance === num
                      ? 'border-indigo-600 bg-indigo-600 text-white'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {num}x
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* SUB-MENU 4: IDENTITAS SEKOLAH & PENGUMUMAN */}
      {activeSubTab === 'identity' && (
        <form
          onSubmit={handleSaveSchool}
          data-testid="settings-panel-identity"
          className="max-w-2xl rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 sm:p-6 space-y-3.5 sm:space-y-4"
        >
          <div className="flex items-start gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
            <Building2 className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-600 dark:text-indigo-400 mt-0.5 shrink-0" />
            <div>
              <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
                Identitas Sekolah & Pengumuman
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Tampil di halaman depan & kop laporan PDF.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <SchoolLogo
              src={schoolForm.logoUrl}
              schoolName={schoolForm.schoolName}
              size="lg"
            />
            <div className="flex-1 space-y-2">
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50">
                <Upload className="h-3.5 w-3.5" />
                <span>Unggah Logo Baru</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
              </label>
              <input
                type="text"
                value={schoolForm.logoUrl}
                onChange={(e) =>
                  setSchoolForm((prev) => ({ ...prev, logoUrl: e.target.value }))
                }
                aria-label="URL Logo Sekolah"
                placeholder="Atau tempel URL logo sekolah"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs font-mono focus:border-indigo-600 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label htmlFor="school-name" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Nama Sekolah / Institusi
            </label>
            <input
              id="school-name"
              type="text"
              value={schoolForm.schoolName}
              onChange={(e) =>
                setSchoolForm((prev) => ({ ...prev, schoolName: e.target.value }))
              }
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs focus:border-indigo-600 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="academic-year" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Tahun Ajaran
            </label>
            <input
              id="academic-year"
              type="text"
              value={schoolForm.academicYear}
              onChange={(e) =>
                setSchoolForm((prev) => ({ ...prev, academicYear: e.target.value }))
              }
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs focus:border-indigo-600 focus:outline-none"
            />
          </div>

          <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <label
                htmlFor="announcement-title"
                className="text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Tampilkan Pengumuman Halaman Depan
              </label>
              <button
                type="button"
                role="switch"
                aria-checked={schoolForm.announcementActive}
                aria-label="Toggle pengumuman aktif"
                onClick={() =>
                  setSchoolForm((prev) => ({
                    ...prev,
                    announcementActive: !prev.announcementActive,
                  }))
                }
                className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${
                  schoolForm.announcementActive ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                    schoolForm.announcementActive ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <input
              id="announcement-title"
              type="text"
              value={schoolForm.announcementTitle}
              onChange={(e) =>
                setSchoolForm((prev) => ({
                  ...prev,
                  announcementTitle: e.target.value,
                }))
              }
              placeholder="Judul pengumuman"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs font-medium focus:border-indigo-600 focus:outline-none"
            />
            <textarea
              rows={3}
              aria-label="Isi teks pengumuman"
              value={schoolForm.announcementText}
              onChange={(e) =>
                setSchoolForm((prev) => ({
                  ...prev,
                  announcementText: e.target.value,
                }))
              }
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs focus:border-indigo-600 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-indigo-700"
          >
            <Save className="h-4 w-4" />
            <span>Simpan Identitas & Pengumuman</span>
          </button>
        </form>
      )}

      {/* SUB-MENU 2: PENGATURAN PENGAWAS UJIAN (OPSIONAL) */}
      {activeSubTab === 'proctor' && (
        <section
          data-testid="admin-proctor-settings-section"
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 sm:p-6 space-y-5"
        >
        <div className="flex items-start gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
          <UserCheck className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-600 dark:text-indigo-400 mt-0.5 shrink-0" />
          <div>
            <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
              Pengaturan Pengawas Ujian (Opsional)
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Aktifkan portal pengawas saat ujian dilaksanakan serentak di banyak kelas. Pengawas memantau ujian & membuka kunci siswa tanpa melihat nilai.
            </p>
          </div>
        </div>

        {/* Mode Switches */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 p-3.5">
            <div className="space-y-0.5">
              <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                Gunakan Pengawas Ujian
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Tampilkan menu Login Pengawas di halaman depan dan aktifkan Portal Pengawas.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              data-testid="toggle-proctor-mode"
              aria-checked={proctorConfig.enabled}
              aria-label="Aktifkan Mode Pengawas Ujian"
              onClick={handleToggleProctorMode}
              className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                proctorConfig.enabled
                  ? 'bg-indigo-600'
                  : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                  proctorConfig.enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 p-3.5">
            <div className="space-y-0.5">
              <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                Izinkan Akun Guru Login sebagai Pengawas
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Guru dapat masuk ke Portal Pengawas menggunakan akun Guru miliknya sesuai penugasan.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              data-testid="toggle-teacher-as-proctor"
              aria-checked={proctorConfig.allowTeacherAccountsAsProctor}
              aria-label="Izinkan Akun Guru Login sebagai Pengawas"
              onClick={handleToggleTeacherAsProctor}
              className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                proctorConfig.allowTeacherAccountsAsProctor
                  ? 'bg-indigo-600'
                  : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                  proctorConfig.allowTeacherAccountsAsProctor
                    ? 'translate-x-6'
                    : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Form & Daftar Akun Pengawas Khusus */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-2">
          <form
            onSubmit={handleSaveProctor}
            data-testid="proctor-account-form"
            className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 p-4 space-y-3 self-start"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                {proctorForm.id
                  ? 'Edit Akun Pengawas Khusus'
                  : 'Tambah Akun Pengawas Khusus'}
              </h3>
              {proctorForm.id && (
                <button
                  type="button"
                  onClick={() => setProctorForm(EMPTY_PROCTOR_FORM)}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-700"
                >
                  <X className="h-3.5 w-3.5" />
                  <span>Batal</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nama Pengawas
                </label>
                <input
                  type="text"
                  data-testid="proctor-name-input"
                  value={proctorForm.name}
                  onChange={(e) =>
                    setProctorForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="Nama lengkap pengawas"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs focus:border-indigo-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  NIP / ID (Opsional)
                </label>
                <input
                  type="text"
                  value={proctorForm.nip}
                  onChange={(e) =>
                    setProctorForm((prev) => ({ ...prev, nip: e.target.value }))
                  }
                  placeholder="Opsional"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-mono focus:border-indigo-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Username Login
                </label>
                <input
                  type="text"
                  data-testid="proctor-username-input"
                  value={proctorForm.username}
                  onChange={(e) =>
                    setProctorForm((prev) => ({
                      ...prev,
                      username: e.target.value,
                    }))
                  }
                  placeholder="cth: pengawas1"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-mono focus:border-indigo-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Password
                </label>
                <input
                  type="text"
                  data-testid="proctor-password-input"
                  value={proctorForm.password}
                  onChange={(e) =>
                    setProctorForm((prev) => ({
                      ...prev,
                      password: e.target.value,
                    }))
                  }
                  placeholder="Password pengawas"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-mono focus:border-indigo-600 focus:outline-none"
                />
              </div>
            </div>

            {/* Paket Ujian yang Diawasi */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Paket Ujian yang Diawasi{' '}
                <span className="font-normal text-slate-500">
                  (kosong = semua paket)
                </span>
              </div>
              <div className="max-h-28 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 space-y-1">
                {db.packages.length === 0 ? (
                  <p className="text-[11px] text-slate-400">
                    Belum ada paket ujian.
                  </p>
                ) : (
                  db.packages.map((pkg) => {
                    const checked = proctorForm.assignedPackageIds.includes(pkg.id);
                    return (
                      <label
                        key={pkg.id}
                        className="flex items-center gap-2 text-[11px] text-slate-700 dark:text-slate-300 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleProctorFormPackage(pkg.id)}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="truncate">
                          {pkg.title} ({pkg.subject})
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            {/* Kelas yang Diawasi */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Kelas yang Diawasi{' '}
                <span className="font-normal text-slate-500">
                  (kosong = semua kelas paket)
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2">
                {allClassNames.map((cls) => {
                  const selected = proctorForm.assignedClasses.includes(cls);
                  return (
                    <button
                      key={cls}
                      type="button"
                      onClick={() => toggleProctorFormClass(cls)}
                      className={`rounded-md border px-2 py-1 text-[11px] font-mono font-semibold transition-colors ${
                        selected
                          ? 'border-indigo-600 bg-indigo-600 text-white'
                          : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      {cls}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="submit"
              data-testid="save-proctor-btn"
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>
                {proctorForm.id ? 'Simpan Perubahan Pengawas' : 'Tambah Akun Pengawas'}
              </span>
            </button>
          </form>

          {/* Daftar Akun Pengawas */}
          <div className="lg:col-span-7 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                Daftar Akun Pengawas Khusus ({proctors.length})
              </h3>
            </div>

            {proctors.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-6 text-center text-xs text-slate-500 dark:text-slate-400">
                Belum ada akun pengawas khusus. Tambahkan di formulir samping atau gunakan akun Guru jika diizinkan.
              </div>
            ) : (
              <div className="space-y-2">
                {proctors.map((account) => {
                  const pkgNames =
                    account.assignedPackageIds.length > 0
                      ? account.assignedPackageIds
                          .map(
                            (id) =>
                              db.packages.find((p) => p.id === id)?.title || id
                          )
                          .join(', ')
                      : 'Semua Paket Ujian';
                  const classLabel =
                    account.assignedClasses.length > 0
                      ? account.assignedClasses.join(', ')
                      : 'Semua Kelas';

                  return (
                    <div
                      key={account.id}
                      data-testid={`proctor-row-${account.username}`}
                      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/40 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900 dark:text-slate-100">
                            {account.name}
                          </span>
                          <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                            @{account.username}
                          </span>
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                              account.active
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                            }`}
                          >
                            {account.active ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-600 dark:text-slate-400 truncate">
                          Paket: <span className="font-medium">{pkgNames}</span>
                        </div>
                        <div className="text-[11px] text-slate-600 dark:text-slate-400 truncate">
                          Kelas: <span className="font-mono font-medium">{classLabel}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => toggleProctorActive(account.id)}
                          className="rounded-md border border-slate-300 dark:border-slate-700 px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
                        >
                          {account.active ? 'Nonaktifkan' : 'Aktifkan'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEditProctor(account)}
                          aria-label={`Edit ${account.name}`}
                          className="rounded-md border border-slate-300 dark:border-slate-700 p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            deleteProctor(account.id);
                            setNotice(`Akun pengawas ${account.name} dihapus.`);
                          }}
                          aria-label={`Hapus ${account.name}`}
                          className="rounded-md border border-rose-200 dark:border-rose-800 p-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Penugasan Akun Guru sebagai Pengawas */}
            {proctorConfig.allowTeacherAccountsAsProctor &&
              db.teachers.length > 0 && (
                <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                    <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      Penugasan Kelas & Paket untuk Guru Pengawas
                    </h3>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Opsional: tentukan paket ujian dan kelas spesifik saat guru masuk menggunakan Portal Pengawas (kosong = seluruh paket & kelas).
                  </p>
                  <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                    {db.teachers.map((teacher) => {
                      const assign =
                        proctorConfig.teacherAssignments?.[teacher.id] || {
                          assignedPackageIds: [],
                          assignedClasses: [],
                        };
                      const isExpanded = editingTeacherAssignId === teacher.id;
                      return (
                        <div
                          key={teacher.id}
                          className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 p-2.5 text-xs"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                                {teacher.name}
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                {assign.assignedPackageIds.length > 0
                                  ? `${assign.assignedPackageIds.length} paket dipilih`
                                  : 'Semua paket'}{' '}
                                ·{' '}
                                {assign.assignedClasses.length > 0
                                  ? assign.assignedClasses.join(', ')
                                  : 'Semua kelas'}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setEditingTeacherAssignId(
                                  isExpanded ? null : teacher.id
                                )
                              }
                              className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 whitespace-nowrap"
                            >
                              {isExpanded ? 'Tutup' : 'Atur Tugas'}
                            </button>
                          </div>

                          {isExpanded && (
                            <div className="mt-2.5 pt-2.5 border-t border-slate-200 dark:border-slate-800 space-y-2">
                              <div className="space-y-1">
                                <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                                  Paket Ujian:
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  {db.packages.map((pkg) => {
                                    const active =
                                      assign.assignedPackageIds.includes(pkg.id);
                                    return (
                                      <button
                                        key={pkg.id}
                                        type="button"
                                        onClick={() =>
                                          handleToggleTeacherAssignmentItem(
                                            teacher.id,
                                            'assignedPackageIds',
                                            pkg.id
                                          )
                                        }
                                        className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${
                                          active
                                            ? 'border-indigo-600 bg-indigo-600 text-white'
                                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300'
                                        }`}
                                      >
                                        {pkg.title}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                              <div className="space-y-1">
                                <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                                  Kelas:
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  {allClassNames.map((cls) => {
                                    const active =
                                      assign.assignedClasses.includes(cls);
                                    return (
                                      <button
                                        key={cls}
                                        type="button"
                                        onClick={() =>
                                          handleToggleTeacherAssignmentItem(
                                            teacher.id,
                                            'assignedClasses',
                                            cls
                                          )
                                        }
                                        className={`rounded-md border px-2 py-0.5 text-[11px] font-mono font-semibold ${
                                          active
                                            ? 'border-indigo-600 bg-indigo-600 text-white'
                                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300'
                                        }`}
                                      >
                                        {cls}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
          </div>
        </div>
        </section>
      )}
    </div>
  );
}
