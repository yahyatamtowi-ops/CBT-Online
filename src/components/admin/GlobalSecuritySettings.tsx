import React, { useEffect, useState } from 'react';
import {
  Building2,
  Camera,
  Moon,
  Palette,
  Save,
  ShieldCheck,
  Sun,
  Upload,
} from 'lucide-react';
import { useCBT } from '../../context/CBTContext';
import type { ThemeAccent, ThemeMode } from '../../types/cbt';
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

export function GlobalSecuritySettings() {
  const { db, updateSecurityConfig, updateSchoolIdentity, updateThemeConfig } = useCBT();
  const [schoolForm, setSchoolForm] = useState(db.school);
  const [notice, setNotice] = useState<string | null>(null);

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
      title: 'Kamera, Pelacakan Wajah & Suara Teguran',
      description:
        'Pantau keberadaan wajah, menoleh kanan/kiri, >1 wajah, dan suara obrolan (pandangan normal ke layar aman). Teguran suara otomatis.',
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

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Keamanan, Tema & Identitas Sekolah
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Atur pengawasan anti-curang, tema tampilan, dan profil sekolah.
        </p>
      </div>

      {notice && (
        <div
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40 px-3.5 py-2.5 text-xs font-medium text-emerald-800 dark:text-emerald-300"
        >
          {notice}
        </div>
      )}

      {/* PENGATURAN TEMA APLIKASI */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 sm:p-6 space-y-3.5 sm:space-y-5">
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

      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-12">
        {/* Global Feature Toggles */}
        <section className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 sm:p-6 space-y-4 sm:space-y-5">
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

        {/* School Identity & Announcement Form */}
        <form
          onSubmit={handleSaveSchool}
          className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 sm:p-6 space-y-3.5 sm:space-y-4 self-start"
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
      </div>
    </div>
  );
}
