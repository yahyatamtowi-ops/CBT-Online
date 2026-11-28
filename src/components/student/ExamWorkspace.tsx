import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  CameraOff,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  DoorOpen,
  Flag,
  LayoutGrid,
  Lock,
  Maximize2,
  Mic,
  MicOff,
  Moon,
  Play,
  Save,
  ShieldAlert,
  Sun,
  UserCheck,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { useCBT } from '../../context/CBTContext';
import type {
  ExamAttempt,
  ExamPackage,
  Question,
  StudentAnswerValue,
} from '../../types/cbt';
import {
  playViolationAlarm,
  primeViolationVoice,
  speakViolationWarning,
} from '../../utils/audioAlert';
import {
  evaluateCameraBehavior,
  formatSecondsToClock,
  getRemainingExamSeconds,
  getRemainingMinSubmitSeconds,
  isQuestionAnswered,
  seededShuffle,
} from '../../utils/cbtLogic';
import { cacheStudentExamSnapshot } from '../../utils/offlineExamCache';

type FontSizeOption = 'sm' | 'md' | 'lg';
type CameraBehaviorStatus =
  | 'focused'
  | 'looking_away'
  | 'looking_down'
  | 'no_face'
  | 'multiple_faces'
  | 'talking';

interface ActiveWarningModal {
  type: string;
  detail: string;
  timestamp: string;
  count: number;
  maxTolerance: number;
  requiresFullscreenReturn: boolean;
}

export function ExamWorkspace({
  attempt,
  examPackage,
  questions,
}: {
  attempt: ExamAttempt;
  examPackage: ExamPackage;
  questions: Question[];
}) {
  const {
    db,
    logout,
    saveStudentAnswer,
    toggleFlagQuestion,
    updateCurrentQuestionIndex,
    recordStudentViolation,
    requestToiletLeave,
    returnFromToiletLeave,
    submitStudentExam,
  } = useCBT();

  const [currentIndex, setCurrentIndex] = useState(
    Math.min(attempt.currentQuestionIndex || 0, Math.max(0, questions.length - 1))
  );
  const [fontSize, setFontSize] = useState<FontSizeOption>('md');
  const [darkMode, setDarkMode] = useState(db.theme.mode === 'dark');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastSavedText, setLastSavedText] = useState('Tersimpan otomatis');
  const [nowMs, setNowMs] = useState(Date.now());

  // Security & lockdown states
  const [warningModal, setWarningModal] = useState<ActiveWarningModal | null>(null);
  const [fullscreenBlockedOverlay, setFullscreenBlockedOverlay] = useState(false);
  const [screenshotShieldActive, setScreenshotShieldActive] = useState(false);

  // Camera & Microphone proctoring states
  const [cameraState, setCameraState] = useState<
    'idle' | 'active' | 'denied' | 'disconnected'
  >(db.security.requireCameraMonitoring ? 'idle' : 'idle');
  const [cameraBehaviorStatus, setCameraBehaviorStatus] =
    useState<CameraBehaviorStatus>('focused');
  const [micActive, setMicActive] = useState(false);
  const [audioLevelPct, setAudioLevelPct] = useState(0);
  const [cameraErrorMsg, setCameraErrorMsg] = useState<string | null>(null);
  const [cameraRetryNonce, setCameraRetryNonce] = useState(0);

  // Tiered Finish modal state
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [confirmChecked, setConfirmChecked] = useState(false);

  // Portrait camera orientation on mobile phones (< 768px) vs landscape on tablet/laptop
  const [isMobilePortrait, setIsMobilePortrait] = useState<boolean>(
    () => typeof window !== 'undefined' && window.innerWidth < 768
  );

  // Active toilet permission leave state (pauses all anti-cheat detections while away)
  const activeToiletRequest = useMemo(
    () =>
      (db.toiletRequests || []).find(
        (r) =>
          r.attemptId === attempt.id &&
          (r.status === 'pending' || r.status === 'confirmed')
      ) || null,
    [db.toiletRequests, attempt.id]
  );
  const isOnToiletLeave = Boolean(activeToiletRequest);
  const isOnToiletLeaveRef = useRef<boolean>(isOnToiletLeave);
  useEffect(() => {
    isOnToiletLeaveRef.current = isOnToiletLeave;
  }, [isOnToiletLeave]);

  useEffect(() => {
    const updateOrientation = () => {
      setIsMobilePortrait(window.innerWidth < 768);
    };
    window.addEventListener('resize', updateOrientation);
    window.addEventListener('orientationchange', updateOrientation);
    return () => {
      window.removeEventListener('resize', updateOrientation);
      window.removeEventListener('orientationchange', updateOrientation);
    };
  }, []);

  const lastViolationAtRef = useRef<number>(0);
  const lastCameraViolationAtRef = useRef<number>(0);
  const examMountedAtRef = useRef<number>(Date.now());
  const monitorStartedAtRef = useRef<number>(Date.now());
  const warningModalOpenRef = useRef<boolean>(false);
  const autoSubmittedRef = useRef<boolean>(false);
  const enteredFullscreenOnceRef = useRef<boolean>(false);
  const screenshotShieldTimerRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const initialSizeRef = useRef<{ w: number; h: number }>({
    w: window.innerWidth,
    h: window.innerHeight,
  });

  useEffect(() => {
    warningModalOpenRef.current = Boolean(warningModal);
  }, [warningModal]);

  // Camera proctoring refs
  const analyzerVideoRef = useRef<HTMLVideoElement | null>(null);
  const proctorVideoRef = useRef<HTMLVideoElement | null>(null);
  const mobileVideoRef = useRef<HTMLVideoElement | null>(null);
  const proctorStreamRef = useRef<MediaStream | null>(null);
  const prevLumaRef = useRef<Uint8Array | null>(null);
  const baselineCentroidXRef = useRef<number | null>(null);
  const baselineCentroidYRef = useRef<number | null>(null);
  const baselineBalanceRef = useRef<number | null>(null);
  const baselineFaceAreaRef = useRef<number | null>(null);
  const baselineFaceBoxRef = useRef<{
    cx: number;
    cy: number;
    halfW: number;
    halfH: number;
  } | null>(null);
  const calibrationSamplesRef = useRef<
    Array<{
      x: number;
      y: number;
      bal: number;
      area: number;
      cxPx: number;
      cyPx: number;
      halfW: number;
      halfH: number;
    }>
  >([]);
  const turnFramesRef = useRef<number>(0);
  const verticalFramesRef = useRef<number>(0);
  const missingFaceFramesRef = useRef<number>(0);
  const speechFramesRef = useRef<number>(0);

  const resetCameraCalibration = useCallback(() => {
    baselineCentroidXRef.current = null;
    baselineCentroidYRef.current = null;
    baselineBalanceRef.current = null;
    baselineFaceAreaRef.current = null;
    baselineFaceBoxRef.current = null;
    calibrationSamplesRef.current = [];
    turnFramesRef.current = 0;
    verticalFramesRef.current = 0;
    missingFaceFramesRef.current = 0;
    speechFramesRef.current = 0;
    monitorStartedAtRef.current = Date.now();
    setCameraBehaviorStatus('focused');
  }, []);

  // Grant a fresh camera warmup whenever student returns from toilet leave
  const prevToiletLeaveRef = useRef<boolean>(isOnToiletLeave);
  useEffect(() => {
    if (prevToiletLeaveRef.current && !isOnToiletLeave) {
      resetCameraCalibration();
    }
    prevToiletLeaveRef.current = isOnToiletLeave;
  }, [isOnToiletLeave, resetCameraCalibration]);

  // Sync dark mode class on <html> without clobbering global theme on unmount
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) root.classList.add('dark');
    else root.classList.remove('dark');
    return () => {
      if (db.theme.mode === 'dark') root.classList.add('dark');
      else root.classList.remove('dark');
    };
  }, [darkMode, db.theme.mode]);

  // Live clock tick (1s) for remaining exam timer, min submit timer, and watermark timestamp
  useEffect(() => {
    const interval = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Online / Offline detector
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Ordered questions matching attempt.questionOrder, appending any newly added questions
  const orderedQuestions = useMemo(() => {
    const byId = new Map(questions.map((q) => [q.id, q]));
    const ordered = attempt.questionOrder
      .map((id) => byId.get(id))
      .filter((q): q is Question => Boolean(q));
    const orderedIds = new Set(ordered.map((q) => q.id));
    const extras = questions.filter((q) => !orderedIds.has(q.id));
    const combined = [...ordered, ...extras];
    return combined.length > 0 ? combined : questions;
  }, [attempt.questionOrder, questions]);

  // Keep currentIndex within bounds if question list shrinks
  useEffect(() => {
    if (orderedQuestions.length > 0 && currentIndex >= orderedQuestions.length) {
      setCurrentIndex(orderedQuestions.length - 1);
    }
  }, [currentIndex, orderedQuestions.length]);

  // Cache active student exam package, questions, and answers in Service Worker Cache Storage
  // so exam execution degrades gracefully if internet drops mid-test.
  useEffect(() => {
    const studentRecord = db.students.find(
      (s) => s.id === attempt.studentId || s.nisn === attempt.studentNisn
    );
    void cacheStudentExamSnapshot({
      student: {
        id: studentRecord?.id || attempt.studentId,
        nisn: attempt.studentNisn,
        name: attempt.studentName,
        className: attempt.className,
        active: studentRecord?.active ?? true,
      },
      examPackage,
      questions: orderedQuestions,
      attempt,
      savedAt: new Date().toISOString(),
    });
  }, [
    attempt,
    db.students,
    examPackage,
    orderedQuestions,
  ]);

  const currentQuestion = orderedQuestions[currentIndex] || orderedQuestions[0];

  const remainingSeconds = getRemainingExamSeconds(
    attempt.startedAt,
    examPackage.durationMinutes,
    attempt.extraMinutes,
    nowMs
  );

  const minSubmitRemainingSeconds = getRemainingMinSubmitSeconds(
    attempt.startedAt,
    examPackage.minSubmitMinutes,
    nowMs
  );

  // Auto-submit once when time reaches 0
  useEffect(() => {
    if (
      attempt.status === 'in_progress' &&
      remainingSeconds <= 0 &&
      !autoSubmittedRef.current
    ) {
      autoSubmittedRef.current = true;
      submitStudentExam(attempt.id);
    }
  }, [attempt.id, attempt.status, remainingSeconds, submitStudentExam]);

  // Prime female TTS voice on mount and first user gesture
  useEffect(() => {
    primeViolationVoice();
    const unlock = () => primeViolationVoice();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      if (screenshotShieldTimerRef.current !== null) {
        window.clearTimeout(screenshotShieldTimerRef.current);
      }
    };
  }, []);

  const triggerViolation = useCallback(
    (type: string, detail: string, requiresFullscreenReturn = false) => {
      if (attempt.status !== 'in_progress') return;
      // Pause ALL violation triggers while student is on approved/requested toilet leave
      if (isOnToiletLeaveRef.current) return;
      const now = Date.now();
      // Debounce duplicate simultaneous events (e.g., blur + visibilitychange)
      if (now - lastViolationAtRef.current < 1600) return;
      lastViolationAtRef.current = now;

      const result = recordStudentViolation(attempt.id, type, detail);
      const severity = result.locked ? 'critical' : 'warning';
      playViolationAlarm(severity);
      speakViolationWarning({
        type,
        severity,
        count: result.nextCount,
        maxTolerance: db.security.maxViolationTolerance,
      });

      if (!result.locked) {
        setWarningModal({
          type,
          detail,
          timestamp: new Date().toLocaleTimeString('id-ID'),
          count: result.nextCount,
          maxTolerance: db.security.maxViolationTolerance,
          requiresFullscreenReturn,
        });
      }
    },
    [attempt.id, attempt.status, db.security.maxViolationTolerance, recordStudentViolation]
  );

  const activateScreenshotShield = useCallback(
    (type: string, detail: string) => {
      if (isOnToiletLeaveRef.current) return;
      setScreenshotShieldActive(true);
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText('').catch(() => {});
      }
      if (screenshotShieldTimerRef.current !== null) {
        window.clearTimeout(screenshotShieldTimerRef.current);
      }
      screenshotShieldTimerRef.current = window.setTimeout(() => {
        setScreenshotShieldActive(false);
        screenshotShieldTimerRef.current = null;
      }, 3600);
      triggerViolation(type, detail);
    },
    [triggerViolation]
  );

  const requestEnterFullscreen = useCallback(async () => {
    try {
      const el = document.documentElement as HTMLElement & {
        webkitRequestFullscreen?: () => Promise<void>;
      };
      if (el.requestFullscreen) {
        await el.requestFullscreen();
        enteredFullscreenOnceRef.current = true;
        setFullscreenBlockedOverlay(false);
      } else if (el.webkitRequestFullscreen) {
        await el.webkitRequestFullscreen();
        enteredFullscreenOnceRef.current = true;
        setFullscreenBlockedOverlay(false);
      }
    } catch {
      // Some embedded iframe environments block requestFullscreen; keep exam playable with other guards active
      setFullscreenBlockedOverlay(false);
    }
  }, []);

  // Attempt fullscreen entry on mount if required by Admin
  useEffect(() => {
    if (db.security.requireFullscreen && attempt.status === 'in_progress') {
      requestEnterFullscreen();
    }
    return () => {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, [attempt.status, db.security.requireFullscreen, requestEnterFullscreen]);

  // Anti-Cheat Event Listeners: Fullscreen exit, Tab switch, Window blur, Split screen resize
  useEffect(() => {
    if (attempt.status !== 'in_progress') return;

    const handleFullscreenChange = () => {
      if (!db.security.requireFullscreen || isOnToiletLeaveRef.current) return;
      if (document.fullscreenElement) {
        enteredFullscreenOnceRef.current = true;
        setFullscreenBlockedOverlay(false);
      } else if (enteredFullscreenOnceRef.current) {
        setFullscreenBlockedOverlay(true);
        triggerViolation(
          'Keluar Mode Fullscreen',
          'Peserta keluar dari mode layar penuh selama sesi ujian berlangsung.',
          true
        );
      }
    };

    const handleVisibilityChange = () => {
      if (!db.security.detectTabSwitchAndSplitScreen) return;
      if (document.hidden) {
        triggerViolation(
          'Pindah Tab / Aplikasi Ditinggalkan',
          'Tab ujian tidak aktif karena siswa berpindah tab atau meminimalkan browser.'
        );
      }
    };

    const handleWindowBlur = () => {
      if (!db.security.detectTabSwitchAndSplitScreen) return;
      // Ignore transient focus loss during the first 4s while browser fullscreen / camera permission prompt settles
      if (Date.now() - examMountedAtRef.current < 4000) return;
      triggerViolation(
        'Kehilangan Fokus Jendela Browser',
        'Kursor atau fokus jendela berpindah ke aplikasi atau layar lain di luar ujian.'
      );
    };

    const handleResize = () => {
      if (!db.security.detectTabSwitchAndSplitScreen) return;
      if (Date.now() - examMountedAtRef.current < 4000) {
        initialSizeRef.current = { w: window.innerWidth, h: window.innerHeight };
        return;
      }
      const prevW = initialSizeRef.current.w;
      const prevH = initialSizeRef.current.h;
      const curW = window.innerWidth;
      const curH = window.innerHeight;
      if (prevW > 500 && (curW < prevW * 0.76 || curH < prevH * 0.72)) {
        triggerViolation(
          'Deteksi Split Screen / Perubahan Layar',
          `Ukuran layar menyusut drastis (${curW}×${curH}px), terindikasi Split Screen atau Floating Window.`
        );
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('resize', handleResize);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('resize', handleResize);
    };
  }, [
    attempt.status,
    db.security.detectTabSwitchAndSplitScreen,
    db.security.requireFullscreen,
    triggerViolation,
  ]);

  // Anti-Cheat: Notification Bar Pull-Down (HP/Tablet) & Enhanced Screenshot Protection
  useEffect(() => {
    const antiNotifScreenshot = db.security.detectNotificationBarAndScreenshot !== false;
    if (!antiNotifScreenshot || attempt.status !== 'in_progress') {
      return;
    }

    const handleTouchStart = (e: TouchEvent) => {
      if (isOnToiletLeaveRef.current) return;
      // Detect 3-finger screenshot gesture widely used on Android smartphones
      if (e.touches.length >= 3) {
        e.preventDefault();
        activateScreenshotShield(
          'Percobaan Screenshot (Gestur 3 Jari)',
          'Terdeteksi gestur 3 jari tangkapan layar pada perangkat HP/tablet.'
        );
        return;
      }
      const firstTouch = e.touches[0];
      if (!firstTouch) return;
      // Top-edge swipe down (notification bar / control center zone on phones & tablets)
      if (firstTouch.clientY <= 44) {
        touchStartYRef.current = firstTouch.clientY;
      } else {
        touchStartYRef.current = null;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (touchStartYRef.current === null) return;
      const touch = e.touches[0];
      if (!touch) return;
      if (touch.clientY - touchStartYRef.current >= 24) {
        e.preventDefault();
        touchStartYRef.current = null;
        triggerViolation(
          'Membuka Bilah Notifikasi (HP/Tablet)',
          'Terdeteksi gestur menarik bilah notifikasi dari bagian atas layar saat ujian berlangsung.'
        );
      }
    };

    const handleTouchEnd = () => {
      touchStartYRef.current = null;
    };

    // Detect OS notification shade / snipping overlay via focus polling & visualViewport
    let wasFocused = document.hasFocus();
    const focusPoll = window.setInterval(() => {
      const nowFocused = document.hasFocus();
      if (
        Date.now() - examMountedAtRef.current >= 4000 &&
        wasFocused &&
        !nowFocused &&
        !document.hidden
      ) {
        triggerViolation(
          'Membuka Bilah Notifikasi / Overlay Sistem',
          'Fokus layar ujian terganggu oleh bilah notifikasi atau panel sistem pada perangkat.'
        );
      }
      wasFocused = nowFocused;
    }, 700);

    const vv = window.visualViewport;
    const handleVisualViewportChange = () => {
      if (!vv) return;
      const activeTag = document.activeElement?.tagName;
      const typingInInput = activeTag === 'TEXTAREA' || activeTag === 'INPUT';
      if (vv.offsetTop > 18 && !typingInInput) {
        triggerViolation(
          'Membuka Bilah Notifikasi / Perubahan Viewport',
          'Terdeteksi pergeseran bilah atas sistem atau overlay notifikasi pada perangkat.'
        );
      }
    };

    const isScreenshotCombo = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const code = e.code || '';
      const isPrintScreen =
        e.key === 'PrintScreen' ||
        code === 'PrintScreen' ||
        e.keyCode === 44 ||
        e.key === 'F13';
      const isWinSnip = (e.metaKey || e.ctrlKey) && e.shiftKey && key === 's';
      const isMacShot =
        e.metaKey && e.shiftKey && ['3', '4', '5', '6'].includes(key);
      const isPrintCombo = (e.ctrlKey || e.metaKey) && key === 'p';
      return isPrintScreen || isWinSnip || isMacShot || isPrintCombo;
    };

    const handleScreenshotKeyDown = (e: KeyboardEvent) => {
      if (isScreenshotCombo(e)) {
        e.preventDefault();
        e.stopPropagation();
        activateScreenshotShield(
          'Percobaan Screenshot / Tangkapan Layar',
          `Kombinasi tombol tangkapan layar (${e.key}) terdeteksi. Layar ujian langsung dikunci dengan tirai hitam.`
        );
      }
    };

    const handleScreenshotKeyUp = (e: KeyboardEvent) => {
      if (isScreenshotCombo(e)) {
        e.preventDefault();
        e.stopPropagation();
        activateScreenshotShield(
          'Percobaan Screenshot / Tangkapan Layar',
          `Tangkapan layar (${e.key}) diblokir dan dicatat sebagai pelanggaran.`
        );
      }
    };

    const handleBeforePrint = (e: Event) => {
      e.preventDefault();
      activateScreenshotShield(
        'Percobaan Cetak / Screenshot Layar',
        'Perintah cetak layar/PDF diblokir selama ujian berlangsung.'
      );
    };

    // Guard navigator.mediaDevices.getDisplayMedia to catch browser screen capture / screen recording
    const mediaDevicesObj = navigator.mediaDevices as
      | (MediaDevices & { getDisplayMedia?: (...args: unknown[]) => Promise<MediaStream> })
      | undefined;
    const originalGetDisplayMedia = mediaDevicesObj?.getDisplayMedia?.bind(mediaDevicesObj);
    if (mediaDevicesObj && typeof originalGetDisplayMedia === 'function') {
      try {
        mediaDevicesObj.getDisplayMedia = async () => {
          activateScreenshotShield(
            'Percobaan Tangkapan / Rekam Layar (Screen Capture)',
            'Upaya merekam atau menangkap tampilan layar ujian melalui API screen capture diblokir.'
          );
          throw new DOMException('Screen capture diblokir selama ujian berlangsung.', 'NotAllowedError');
        };
      } catch {
        // Ignore read-only mediaDevices property in strict browsers
      }
    }

    window.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('keydown', handleScreenshotKeyDown, { capture: true });
    window.addEventListener('keyup', handleScreenshotKeyUp, { capture: true });
    window.addEventListener('beforeprint', handleBeforePrint);
    vv?.addEventListener('resize', handleVisualViewportChange);

    return () => {
      window.clearInterval(focusPoll);
      if (mediaDevicesObj && typeof originalGetDisplayMedia === 'function') {
        try {
          mediaDevicesObj.getDisplayMedia = originalGetDisplayMedia;
        } catch {
          // Ignore restore error
        }
      }
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('keydown', handleScreenshotKeyDown, { capture: true });
      window.removeEventListener('keyup', handleScreenshotKeyUp, { capture: true });
      window.removeEventListener('beforeprint', handleBeforePrint);
      vv?.removeEventListener('resize', handleVisualViewportChange);
    };
  }, [
    activateScreenshotShield,
    attempt.status,
    db.security.detectNotificationBarAndScreenshot,
    triggerViolation,
  ]);

  // Anti-Cheat Event Listeners: Right-click, Copy/Paste, Drag, DevTools
  useEffect(() => {
    if (!db.security.blockRightClickAndCopyPaste || attempt.status !== 'in_progress') {
      return;
    }

    const blockEvent = (e: Event) => {
      e.preventDefault();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const ctrlOrMeta = e.ctrlKey || e.metaKey;
      const targetTag = (e.target as HTMLElement | null)?.tagName;
      const isEditingEssay = targetTag === 'TEXTAREA' || targetTag === 'INPUT';

      const isDevTools =
        e.key === 'F12' ||
        (ctrlOrMeta && e.shiftKey && ['i', 'j', 'c'].includes(key));

      const blockedKeys = isEditingEssay
        ? ['c', 'v', 'x', 'p', 's', 'u']
        : ['c', 'v', 'x', 'a', 'p', 's', 'u'];
      const isBlockedShortcut = ctrlOrMeta && blockedKeys.includes(key);
      const isAltTab = e.altKey && key === 'tab';

      if (isDevTools || isBlockedShortcut || isAltTab) {
        e.preventDefault();
        triggerViolation(
          isDevTools ? 'Percobaan Inspeksi DevTools' : 'Pintasan Keyboard Terlarang',
          `Kombinasi tombol terlarang (${e.ctrlKey ? 'Ctrl+' : ''}${
            e.shiftKey ? 'Shift+' : ''
          }${e.altKey ? 'Alt+' : ''}${e.key}) diblokir oleh sistem.`
        );
      }
    };

    document.addEventListener('contextmenu', blockEvent);
    document.addEventListener('copy', blockEvent);
    document.addEventListener('cut', blockEvent);
    document.addEventListener('paste', blockEvent);
    document.addEventListener('dragstart', blockEvent);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('contextmenu', blockEvent);
      document.removeEventListener('copy', blockEvent);
      document.removeEventListener('cut', blockEvent);
      document.removeEventListener('paste', blockEvent);
      document.removeEventListener('dragstart', blockEvent);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [attempt.status, db.security.blockRightClickAndCopyPaste, triggerViolation]);

  // Camera & Audio Proctoring: calibrated face bounding-box, gaze yaw/pitch, missing/multiple face & speech tracking
  useEffect(() => {
    if (!db.security.requireCameraMonitoring || attempt.status !== 'in_progress') {
      return;
    }

    let cancelled = false;
    let monitorInterval: number | null = null;
    let audioCtx: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let audioBuffer: Float32Array<ArrayBuffer> | null = null;
    // Use portrait canvas dimensions on phones (72x96) and landscape on tablets/laptops (96x72)
    // so mobile portrait video frames stay crisp and undistorted for head/face tracking.
    const W = isMobilePortrait ? 72 : 96;
    const H = isMobilePortrait ? 96 : 72;
    const offscreen = document.createElement('canvas');
    offscreen.width = W;
    offscreen.height = H;
    const ctx2d = offscreen.getContext('2d', { willReadFrequently: true });

    // Optional native Chrome/Edge FaceDetector API for precise bounding box & landmark yaw
    type DetectedFaceLike = {
      boundingBox: { x: number; y: number; width: number; height: number };
      landmarks?: Array<{ type?: string; locations?: Array<{ x: number; y: number }> }>;
    };
    type FaceDetectorLike = {
      detect: (src: CanvasImageSource) => Promise<DetectedFaceLike[]>;
    };
    const FaceDetectorCtor = (
      window as unknown as {
        FaceDetector?: new (opts?: { fastMode?: boolean; maxDetectedFaces?: number }) => FaceDetectorLike;
      }
    ).FaceDetector;
    let nativeDetector: FaceDetectorLike | null = null;
    if (typeof FaceDetectorCtor === 'function') {
      try {
        nativeDetector = new FaceDetectorCtor({ fastMode: true, maxDetectedFaces: 3 });
      } catch {
        nativeDetector = null;
      }
    }

    prevLumaRef.current = null;
    baselineCentroidXRef.current = null;
    baselineCentroidYRef.current = null;
    baselineBalanceRef.current = null;
    baselineFaceAreaRef.current = null;
    baselineFaceBoxRef.current = null;
    calibrationSamplesRef.current = [];
    turnFramesRef.current = 0;
    verticalFramesRef.current = 0;
    missingFaceFramesRef.current = 0;
    speechFramesRef.current = 0;

    const attachStreamToVideos = (stream: MediaStream | null) => {
      for (const el of [
        analyzerVideoRef.current,
        proctorVideoRef.current,
        mobileVideoRef.current,
      ]) {
        if (el) {
          el.srcObject = stream;
          if (stream) {
            el.play().catch(() => {});
          }
        }
      }
    };

    const cleanupMedia = () => {
      if (monitorInterval !== null) {
        window.clearInterval(monitorInterval);
        monitorInterval = null;
      }
      if (proctorStreamRef.current) {
        proctorStreamRef.current.getTracks().forEach((t) => t.stop());
        proctorStreamRef.current = null;
      }
      attachStreamToVideos(null);
      if (audioCtx) {
        audioCtx.close().catch(() => {});
        audioCtx = null;
      }
    };

    const initCameraMonitor = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraState('denied');
        setCameraErrorMsg('Perangkat/browser tidak mendukung akses kamera.');
        return;
      }

      try {
        const videoConstraints = isMobilePortrait
          ? { width: { ideal: 240 }, height: { ideal: 320 }, facingMode: 'user' as const }
          : { width: { ideal: 320 }, height: { ideal: 240 }, facingMode: 'user' as const };
        let stream: MediaStream;
        let hasAudio = false;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: videoConstraints,
            audio: true,
          });
          hasAudio = stream.getAudioTracks().length > 0;
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({
            video: videoConstraints,
            audio: false,
          });
          hasAudio = false;
        }

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        proctorStreamRef.current = stream;
        monitorStartedAtRef.current = Date.now();
        setCameraState('active');
        setMicActive(hasAudio);
        setCameraErrorMsg(null);
        attachStreamToVideos(stream);

        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          videoTrack.addEventListener('ended', () => {
            if (!cancelled) {
              setCameraState('disconnected');
              setCameraErrorMsg('Kamera terputus saat ujian berlangsung.');
              triggerViolation(
                'Kamera Pengawas Dinonaktifkan',
                'Aliran kamera pengawas terputus atau dinonaktifkan secara manual saat ujian berlangsung.'
              );
            }
          });
        }

        if (hasAudio && typeof AudioContext !== 'undefined') {
          try {
            audioCtx = new AudioContext();
            const source = audioCtx.createMediaStreamSource(stream);
            analyser = audioCtx.createAnalyser();
            analyser.fftSize = 512;
            source.connect(analyser);
            audioBuffer = new Float32Array(new ArrayBuffer(analyser.fftSize * 4));
          } catch {
            analyser = null;
          }
        }

        const GRID_COLS = isMobilePortrait ? 9 : 12;
        const GRID_ROWS = isMobilePortrait ? 12 : 9;
        const CELL_W = W / GRID_COLS; // 8px
        const CELL_H = H / GRID_ROWS; // 8px
        const CAMERA_WARMUP_MS = 6000;
        const CAMERA_VIOLATION_COOLDOWN_MS = 6000;

        let processingFrame = false;
        monitorInterval = window.setInterval(async () => {
          if (cancelled || processingFrame) return;
          // Pause camera/audio violation evaluation while student is on toilet leave
          // or while a warning modal is still displayed on screen
          if (isOnToiletLeaveRef.current || warningModalOpenRef.current) {
            turnFramesRef.current = 0;
            verticalFramesRef.current = 0;
            missingFaceFramesRef.current = 0;
            speechFramesRef.current = 0;
            return;
          }
          processingFrame = true;
          try {
            // Always prefer the non-display:none analyzerVideoRef so phones/tablets decode reliably
            const videoEl =
              (analyzerVideoRef.current && analyzerVideoRef.current.readyState >= 2
                ? analyzerVideoRef.current
                : null) ||
              (proctorVideoRef.current && proctorVideoRef.current.readyState >= 2
                ? proctorVideoRef.current
                : null) ||
              (mobileVideoRef.current && mobileVideoRef.current.readyState >= 2
                ? mobileVideoRef.current
                : null);

            // Re-attach stream if a preview element mounted after stream activation
            if (proctorStreamRef.current) {
              for (const el of [
                analyzerVideoRef.current,
                proctorVideoRef.current,
                mobileVideoRef.current,
              ]) {
                if (el && el.srcObject !== proctorStreamRef.current) {
                  el.srcObject = proctorStreamRef.current;
                  el.play().catch(() => {});
                }
              }
            }

            let horizontalShift = 0;
            let verticalShift = 0;
            let lateralMotionScore = 0;
            let eyeYawScore = 0;
            let faceDetected = true;
            let faceCount = 1;
            let faceAreaRatio = 1;
            let cameraOccluded = false;
            let faceOutOfBounds = false;

            if (videoEl && videoEl.readyState >= 2 && ctx2d) {
              ctx2d.drawImage(videoEl, 0, 0, W, H);
              const imgData = ctx2d.getImageData(0, 0, W, H).data;
              const currentLuma = new Uint8Array(W * H);
              const skinMask = new Uint8Array(W * H);
              const cellSkin = new Uint16Array(GRID_COLS * GRID_ROWS);

              let sumLuma = 0;
              let sumLumaSq = 0;
              let sampledPixels = 0;
              let leftDiff = 0;
              let rightDiff = 0;
              let regionPixels = 0;

              for (let y = 4; y < H - 4; y++) {
                const gy = Math.min(GRID_ROWS - 1, Math.floor(y / CELL_H));
                for (let x = 6; x < W - 6; x++) {
                  const pIdx = y * W + x;
                  const dIdx = pIdx * 4;
                  const r = imgData[dIdx];
                  const g = imgData[dIdx + 1];
                  const b = imgData[dIdx + 2];
                  const luma = (r * 77 + g * 150 + b * 29) >> 8;
                  currentLuma[pIdx] = luma;
                  sumLuma += luma;
                  sumLumaSq += luma * luma;
                  sampledPixels += 1;

                  // Broad YCbCr skin-tone segmentation (robust across indoor lighting & skin tones)
                  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
                  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
                  const isSkin =
                    luma > 22 &&
                    cb >= 72 &&
                    cb <= 132 &&
                    cr >= 128 &&
                    cr <= 178;

                  if (isSkin) {
                    skinMask[pIdx] = 1;
                    const gx = Math.min(GRID_COLS - 1, Math.floor(x / CELL_W));
                    cellSkin[gy * GRID_COLS + gx] += 1;
                  }

                  if (prevLumaRef.current) {
                    const diff = Math.abs(luma - prevLumaRef.current[pIdx]);
                    if (diff > 24) {
                      if (x < W / 2) leftDiff += 1;
                      else rightDiff += 1;
                    }
                    regionPixels += 1;
                  }
                }
              }

              prevLumaRef.current = currentLuma;

              if (sampledPixels > 0) {
                const avgLuma = sumLuma / sampledPixels;
                const variance = Math.max(
                  0,
                  sumLumaSq / sampledPixels - avgLuma * avgLuma
                );
                const lumaStd = Math.sqrt(variance);
                // Detect truly covered lens or pitch-black frame (avoid false occlusion in dim rooms)
                cameraOccluded = avgLuma < 12 || lumaStd < 6;
              }

              // Helper to compute left vs right skin balance inside a fixed anchor box
              const measureBoxSkinBalance = (box: {
                cx: number;
                cy: number;
                halfW: number;
                halfH: number;
              }) => {
                const x0 = Math.max(4, Math.floor(box.cx - box.halfW));
                const x1 = Math.min(W - 4, Math.ceil(box.cx + box.halfW));
                const y0 = Math.max(4, Math.floor(box.cy - box.halfH));
                const y1 = Math.min(H - 4, Math.ceil(box.cy + box.halfH));
                let leftS = 0;
                let rightS = 0;
                for (let y = y0; y < y1; y++) {
                  for (let x = x0; x < x1; x++) {
                    if (skinMask[y * W + x]) {
                      if (x < box.cx) leftS += 1;
                      else rightS += 1;
                    }
                  }
                }
                const total = leftS + rightS;
                return {
                  total,
                  balance: total > 14 ? (rightS - leftS) / total : 0,
                };
              };

              let cxNorm: number | null = null;
              let cyNorm: number | null = null;
              let balanceNorm = 0;
              let landmarkYaw: number | null = null;
              let currentFaceArea = 0;
              let currentBoxPx: {
                cx: number;
                cy: number;
                halfW: number;
                halfH: number;
              } | null = null;

              // Prefer native Chrome/Edge FaceDetector when supported by browser
              let usedNative = false;
              if (nativeDetector && !cameraOccluded) {
                try {
                  const faces = await nativeDetector.detect(offscreen);
                  usedNative = true;
                  faceCount = faces.length;
                  faceDetected = faces.length > 0;
                  if (faces.length > 0) {
                    const primary = faces[0].boundingBox;
                    const faceCenterX = primary.x + primary.width / 2;
                    const faceCenterY = primary.y + primary.height / 2;
                    cxNorm = (faceCenterX - W / 2) / (W * 0.42);
                    cyNorm = (faceCenterY - H / 2) / (H * 0.42);
                    currentFaceArea = primary.width * primary.height;
                    currentBoxPx = {
                      cx: faceCenterX,
                      cy: faceCenterY,
                      halfW: Math.max(8, primary.width * 0.55),
                      halfH: Math.max(10, primary.height * 0.55),
                    };

                    // Out-of-bounds check ONLY when face truly exits the outer camera boundary
                    faceOutOfBounds =
                      faceCenterX < W * 0.04 ||
                      faceCenterX > W * 0.96 ||
                      faceCenterY < H * 0.04 ||
                      faceCenterY > H * 0.96 ||
                      primary.width < 8;

                    // Extract real head yaw from native facial landmarks (nose & eyes)
                    const landmarks = faces[0].landmarks || [];
                    const noseLm = landmarks.find((lm) => lm.type === 'nose');
                    const eyeLms = landmarks.filter((lm) => lm.type === 'eye');
                    if (noseLm?.locations && noseLm.locations.length > 0) {
                      const noseX = noseLm.locations[0].x;
                      if (
                        eyeLms.length >= 2 &&
                        eyeLms[0].locations?.[0] &&
                        eyeLms[1].locations?.[0]
                      ) {
                        const e1x = eyeLms[0].locations[0].x;
                        const e2x = eyeLms[1].locations[0].x;
                        const leftEyeX = Math.min(e1x, e2x);
                        const rightEyeX = Math.max(e1x, e2x);
                        const eyeSpan = Math.max(4, rightEyeX - leftEyeX);
                        const eyeMidX = (leftEyeX + rightEyeX) / 2;
                        landmarkYaw = Math.max(
                          -1,
                          Math.min(1, (noseX - eyeMidX) / (eyeSpan * 0.55))
                        );
                      } else {
                        landmarkYaw = Math.max(
                          -1,
                          Math.min(
                            1,
                            (noseX - faceCenterX) / Math.max(6, primary.width * 0.34)
                          )
                        );
                      }
                    }

                    // Measure cheek skin balance inside fixed calibrated anchor (or current face box)
                    const anchorBox = baselineFaceBoxRef.current || currentBoxPx;
                    balanceNorm = measureBoxSkinBalance(anchorBox).balance;
                  }
                } catch {
                  usedNative = false;
                }
              }

              if (!usedNative && !cameraOccluded) {
                // Find the densest 3x3 head-sized skin cluster on the 12x9 spatial grid
                // so scattered warm walls/desks never fool the detector into thinking a face is present
                let bestScore = 0;
                let bestGx = Math.floor(GRID_COLS / 2);
                let bestGy = Math.floor(GRID_ROWS / 2);

                for (let gy = 1; gy < GRID_ROWS - 1; gy++) {
                  for (let gx = 1; gx < GRID_COLS - 1; gx++) {
                    let windowSum = 0;
                    for (let dy = -1; dy <= 1; dy++) {
                      for (let dx = -1; dx <= 1; dx++) {
                        windowSum += cellSkin[(gy + dy) * GRID_COLS + (gx + dx)];
                      }
                    }
                    if (windowSum > bestScore) {
                      bestScore = windowSum;
                      bestGx = gx;
                      bestGy = gy;
                    }
                  }
                }

                // Accumulate face cluster pixels inside a 5x5 head neighborhood around peak
                const rx0 = Math.max(6, Math.floor((bestGx - 2) * CELL_W));
                const rx1 = Math.min(W - 6, Math.ceil((bestGx + 3) * CELL_W));
                const ry0 = Math.max(4, Math.floor((bestGy - 2) * CELL_H));
                const ry1 = Math.min(H - 4, Math.ceil((bestGy + 3) * CELL_H));

                let clusterSkin = 0;
                let sumX = 0;
                let sumY = 0;
                let cMinX = W;
                let cMaxX = 0;
                let cMinY = H;
                let cMaxY = 0;

                for (let y = ry0; y < ry1; y++) {
                  for (let x = rx0; x < rx1; x++) {
                    if (skinMask[y * W + x]) {
                      clusterSkin += 1;
                      sumX += x;
                      sumY += y;
                      if (x < cMinX) cMinX = x;
                      if (x > cMaxX) cMaxX = x;
                      if (y < cMinY) cMinY = y;
                      if (y > cMaxY) cMaxY = y;
                    }
                  }
                }

                // Keep any visible face inside camera range detected reliably across devices & lighting
                faceDetected = clusterSkin >= 36 && bestScore >= 18;
                faceCount = faceDetected ? 1 : 0;

                if (faceDetected) {
                  const avgX = sumX / clusterSkin;
                  const avgY = sumY / clusterSkin;
                  cxNorm = (avgX - W / 2) / (W * 0.4);
                  cyNorm = (avgY - H / 2) / (H * 0.4);
                  currentFaceArea = clusterSkin;
                  currentBoxPx = {
                    cx: avgX,
                    cy: avgY,
                    halfW: Math.max(10, Math.min(24, (cMaxX - cMinX) * 0.55)),
                    halfH: Math.max(12, Math.min(26, (cMaxY - cMinY) * 0.55)),
                  };

                  // Only flag out-of-bounds when face exits near the very outer camera boundary
                  faceOutOfBounds =
                    avgX < W * 0.04 ||
                    avgX > W * 0.96 ||
                    avgY < H * 0.04 ||
                    avgY > H * 0.96;

                  const anchorBox = baselineFaceBoxRef.current || currentBoxPx;
                  const anchorStats = measureBoxSkinBalance(anchorBox);
                  balanceNorm = anchorStats.balance;
                }
              } else if (cameraOccluded) {
                faceDetected = false;
                faceCount = 0;
              }

              if (
                faceDetected &&
                cxNorm !== null &&
                cyNorm !== null &&
                currentBoxPx !== null
              ) {
                if (
                  baselineCentroidXRef.current === null ||
                  baselineCentroidYRef.current === null ||
                  baselineBalanceRef.current === null ||
                  baselineFaceAreaRef.current === null ||
                  baselineFaceBoxRef.current === null
                ) {
                  calibrationSamplesRef.current.push({
                    x: cxNorm,
                    y: cyNorm,
                    bal: balanceNorm,
                    area: Math.max(1, currentFaceArea),
                    cxPx: currentBoxPx.cx,
                    cyPx: currentBoxPx.cy,
                    halfW: currentBoxPx.halfW,
                    halfH: currentBoxPx.halfH,
                  });
                  if (calibrationSamplesRef.current.length >= 4) {
                    const samples = calibrationSamplesRef.current;
                    const n = samples.length;
                    baselineCentroidXRef.current =
                      samples.reduce((s, p) => s + p.x, 0) / n;
                    baselineCentroidYRef.current =
                      samples.reduce((s, p) => s + p.y, 0) / n;
                    baselineBalanceRef.current =
                      samples.reduce((s, p) => s + p.bal, 0) / n;
                    baselineFaceAreaRef.current =
                      samples.reduce((s, p) => s + p.area, 0) / n;
                    baselineFaceBoxRef.current = {
                      cx: samples.reduce((s, p) => s + p.cxPx, 0) / n,
                      cy: samples.reduce((s, p) => s + p.cyPx, 0) / n,
                      halfW: samples.reduce((s, p) => s + p.halfW, 0) / n,
                      halfH: samples.reduce((s, p) => s + p.halfH, 0) / n,
                    };
                  }
                } else {
                  horizontalShift = Math.max(
                    -1,
                    Math.min(1, cxNorm - baselineCentroidXRef.current)
                  );
                  verticalShift = Math.max(
                    -1,
                    Math.min(1, cyNorm - baselineCentroidYRef.current)
                  );
                  const anchorYaw = Math.max(
                    -1,
                    Math.min(1, balanceNorm - baselineBalanceRef.current)
                  );
                  eyeYawScore =
                    landmarkYaw !== null && Math.abs(landmarkYaw) >= Math.abs(anchorYaw)
                      ? landmarkYaw
                      : anchorYaw;
                  faceAreaRatio =
                    baselineFaceAreaRef.current > 0
                      ? currentFaceArea / baselineFaceAreaRef.current
                      : 1;

                  // Adapt baseline very slowly ONLY when squarely centered and full-size
                  if (
                    Math.abs(horizontalShift) < 0.08 &&
                    Math.abs(eyeYawScore) < 0.10 &&
                    faceAreaRatio > 0.78 &&
                    faceAreaRatio < 1.25
                  ) {
                    baselineCentroidXRef.current =
                      baselineCentroidXRef.current * 0.992 + cxNorm * 0.008;
                    baselineBalanceRef.current =
                      baselineBalanceRef.current * 0.992 + balanceNorm * 0.008;
                    baselineFaceAreaRef.current =
                      baselineFaceAreaRef.current * 0.992 + currentFaceArea * 0.008;
                  }
                }
              }

              if (regionPixels > 0) {
                const totalMoved = leftDiff + rightDiff;
                const asymmetry = Math.abs(leftDiff - rightDiff) / (regionPixels * 0.36);
                lateralMotionScore = totalMoved > 70 ? Math.min(1, asymmetry * 1.55) : 0;
              }
            }

            let audioRms = 0;
            if (analyser && audioBuffer) {
              analyser.getFloatTimeDomainData(audioBuffer);
              let sumSq = 0;
              for (let i = 0; i < audioBuffer.length; i++) {
                sumSq += audioBuffer[i] * audioBuffer[i];
              }
              audioRms = Math.sqrt(sumSq / audioBuffer.length);
              setAudioLevelPct(Math.min(100, Math.round(audioRms * 450)));
            }

            const nowTime = Date.now();
            const inWarmupGrace = nowTime - monitorStartedAtRef.current < CAMERA_WARMUP_MS;
            const isCalibrating = baselineCentroidXRef.current === null;

            const evaluation = evaluateCameraBehavior({
              horizontalShift,
              verticalShift,
              lateralMotionScore,
              eyeYawScore,
              faceDetected,
              faceCount,
              faceAreaRatio,
              cameraOccluded,
              faceOutOfBounds,
              audioRms,
              consecutiveTurnFrames: turnFramesRef.current,
              consecutiveSpeechFrames: speechFramesRef.current,
              consecutiveMissingFaceFrames: missingFaceFramesRef.current,
              consecutiveVerticalFrames: verticalFramesRef.current,
              inWarmupGrace,
              isCalibrating,
            });

            turnFramesRef.current = evaluation.nextTurnFrames;
            speechFramesRef.current = evaluation.nextSpeechFrames;
            missingFaceFramesRef.current = evaluation.nextMissingFaceFrames;
            verticalFramesRef.current = evaluation.nextVerticalFrames;
            setCameraBehaviorStatus(evaluation.status);

            if (
              evaluation.shouldFlagViolation &&
              evaluation.violationType &&
              evaluation.violationDetail &&
              nowTime - lastCameraViolationAtRef.current >= CAMERA_VIOLATION_COOLDOWN_MS
            ) {
              lastCameraViolationAtRef.current = nowTime;
              triggerViolation(evaluation.violationType, evaluation.violationDetail);
            }
          } finally {
            processingFrame = false;
          }
        }, 500);
      } catch {
        if (!cancelled) {
          setCameraState('denied');
          setMicActive(false);
          setCameraErrorMsg(
            'Akses kamera tidak aktif. Klik Aktifkan Kamera agar pengawasan berjalan.'
          );
        }
      }
    };

    initCameraMonitor();

    return () => {
      cancelled = true;
      cleanupMedia();
    };
  }, [
    attempt.status,
    cameraRetryNonce,
    db.security.requireCameraMonitoring,
    isMobilePortrait,
    triggerViolation,
  ]);

  const handleSelectQuestion = (idx: number) => {
    const safeIdx = Math.max(0, Math.min(idx, orderedQuestions.length - 1));
    setCurrentIndex(safeIdx);
    updateCurrentQuestionIndex(attempt.id, safeIdx);
    setMobileNavOpen(false);
  };

  const handleAnswerChange = (questionId: string, val: StudentAnswerValue) => {
    saveStudentAnswer(attempt.id, questionId, val);
    setLastSavedText(
      `Tersimpan ${new Date().toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })}`
    );
  };

  const answeredCount = orderedQuestions.filter((q) =>
    isQuestionAnswered(q, attempt.answers[q.id])
  ).length;
  const unansweredCount = orderedQuestions.length - answeredCount;
  const activeQuestionIds = useMemo(
    () => new Set(orderedQuestions.map((q) => q.id)),
    [orderedQuestions]
  );
  const flaggedCount = attempt.flaggedQuestionIds.filter((id) =>
    activeQuestionIds.has(id)
  ).length;

  const fontSizeClass =
    fontSize === 'sm'
      ? 'text-sm leading-relaxed'
      : fontSize === 'lg'
      ? 'text-lg leading-relaxed'
      : 'text-base leading-relaxed';

  // Build display options respecting shuffle order and appending any newly added options (e.g. Option E)
  const currentOptions = useMemo(() => {
    if (!currentQuestion?.options) return [];
    const order = attempt.optionOrders[currentQuestion.id];
    if (!order || order.length === 0) return currentQuestion.options;
    const byId = new Map(currentQuestion.options.map((o) => [o.id, o]));
    const mapped = order
      .map((id) => byId.get(id))
      .filter((o): o is NonNullable<typeof o> => Boolean(o));
    const mappedIds = new Set(mapped.map((o) => o.id));
    const extras = currentQuestion.options.filter((o) => !mappedIds.has(o.id));
    return [...mapped, ...extras];
  }, [attempt.optionOrders, currentQuestion]);

  // Shuffled right-side choices for matching questions
  const matchingRightChoices = useMemo(() => {
    if (!currentQuestion?.matchingPairs) return [];
    const rights = currentQuestion.matchingPairs.map((p) => p.right);
    return seededShuffle(rights, `${attempt.studentNisn}-${currentQuestion.id}-right`);
  }, [attempt.studentNisn, currentQuestion]);

  const watermarkLabel = `${attempt.studentNisn} · ${attempt.studentName} · ${new Date(
    nowMs
  ).toLocaleTimeString('id-ID')}`;

  if (!currentQuestion) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 p-8 text-center space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Paket soal tidak memiliki butir pertanyaan.
        </p>
        <button
          type="button"
          onClick={logout}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
        >
          Kembali ke Beranda
        </button>
      </div>
    );
  }

  const currentAnswer = attempt.answers[currentQuestion.id];
  const isCurrentFlagged = attempt.flaggedQuestionIds.includes(currentQuestion.id);

  const cameraStatusLabel =
    cameraState !== 'active'
      ? 'Kamera Nonaktif'
      : cameraBehaviorStatus === 'multiple_faces'
        ? '>1 Wajah!'
        : cameraBehaviorStatus === 'no_face'
          ? 'Keluar Kamera!'
          : cameraBehaviorStatus === 'talking'
            ? 'Suara Mengobrol!'
            : 'Wajah Terpantau';

  return (
    <div
      data-testid="exam-workspace-root"
      className={`min-h-dvh md:h-dvh md:overflow-hidden bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 flex flex-col exam-print-shield ${
        db.security.blockRightClickAndCopyPaste ? 'exam-no-select' : ''
      }`}
    >
      {/* Always-mounted non-display:none video element so camera frame decoding works on phones, tablets & laptops */}
      {db.security.requireCameraMonitoring && (
        <video
          ref={analyzerVideoRef}
          autoPlay
          playsInline
          muted
          aria-hidden="true"
          className="pointer-events-none fixed top-0 left-0 h-2 w-2 opacity-[0.01] -z-10"
        />
      )}
      {/* Offline Warning Banner */}
      {!isOnline && (
        <div
          role="alert"
          className="shrink-0 bg-amber-600 text-white px-4 py-2 text-center text-xs font-semibold flex items-center justify-center gap-2"
        >
          <WifiOff className="h-4 w-4 shrink-0" />
          <span>
            Koneksi terputus, jawaban tersimpan aman di perangkat. Jangan tutup browser.
          </span>
        </div>
      )}

      {/* Compact Exam Top Bar */}
      <header className="sticky top-0 md:static shrink-0 z-30 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2 sm:px-5">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-400 truncate">
              {examPackage.subject} · {attempt.studentName} ({attempt.studentNisn})
            </div>
            <div className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
              {examPackage.title}
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            {/* Compact Camera Proctoring Status */}
            {db.security.requireCameraMonitoring && (
              <div
                className={`hidden md:inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold ${
                  cameraState !== 'active'
                    ? 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                    : cameraBehaviorStatus === 'focused'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                      : 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                }`}
              >
                {cameraState === 'active' ? (
                  <Camera className="h-3.5 w-3.5" />
                ) : (
                  <CameraOff className="h-3.5 w-3.5" />
                )}
                <span>{cameraStatusLabel}</span>
              </div>
            )}

            {/* Timer */}
            <div
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-mono text-sm font-bold tabular-nums ${
                remainingSeconds <= 300
                  ? 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                  : 'border-slate-200 bg-slate-50 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'
              }`}
              aria-label="Sisa waktu ujian"
            >
              <Clock className="h-3.5 w-3.5" />
              <span>{formatSecondsToClock(remainingSeconds)}</span>
            </div>

            {/* Font Size Controls */}
            <div
              className="hidden sm:inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-800"
              role="group"
              aria-label="Ukuran huruf soal"
            >
              {(['sm', 'md', 'lg'] as FontSizeOption[]).map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => setFontSize(sz)}
                  className={`rounded-md px-2 py-0.5 text-xs font-bold uppercase transition-colors ${
                    fontSize === sz
                      ? 'bg-white text-indigo-700 shadow-xs dark:bg-slate-700 dark:text-indigo-300'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                  }`}
                >
                  {sz === 'sm' ? 'S' : sz === 'md' ? 'M' : 'L'}
                </button>
              ))}
            </div>

            {/* Dark/Light Mode Toggle */}
            <button
              type="button"
              onClick={() => setDarkMode((d) => !d)}
              aria-label={darkMode ? 'Aktifkan mode terang' : 'Aktifkan mode gelap'}
              className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            {/* Mobile Question Map Trigger (< md) */}
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Buka peta nomor soal"
              className="md:hidden inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <LayoutGrid className="h-4 w-4" />
              <span className="font-mono tabular-nums">
                {currentIndex + 1}/{orderedQuestions.length}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Exam Layout (Mobile elevates Prev/Next naturally above bottom bar; Tablet & Desktop fit 100% screen height) */}
      <main className="relative mx-auto w-full max-w-7xl md:flex-1 md:min-h-0 md:overflow-hidden grid grid-cols-1 md:grid-cols-12 gap-2.5 md:gap-3.5 px-3.5 pt-2.5 pb-16 sm:px-5 md:py-3">
        {/* Portrait Mobile Camera Monitor Strip (< md): Taller portrait preview for spacious head & shoulder framing */}
        {db.security.requireCameraMonitoring && (
          <div
            data-testid="mobile-camera-strip"
            className="md:hidden flex items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                data-testid="mobile-camera-preview"
                className="relative h-24 w-[72px] aspect-[3/4] shrink-0 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-900 flex items-center justify-center"
              >
                <video
                  ref={mobileVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`h-full w-full object-cover -scale-x-100 ${
                    cameraState === 'active' ? 'block' : 'hidden'
                  }`}
                />
                {cameraState !== 'active' && (
                  <CameraOff className="h-4 w-4 text-slate-400" />
                )}
              </div>
              <div className="min-w-0 space-y-0.5">
                <div
                  className={`font-semibold text-xs truncate ${
                    cameraState !== 'active'
                      ? 'text-rose-600 dark:text-rose-400'
                      : cameraBehaviorStatus === 'focused'
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {cameraStatusLabel}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  Kamera Potret Aktif
                </div>
                <div className="text-[10px] font-mono text-slate-400 dark:text-slate-500 tabular-nums">
                  Pelanggaran: {attempt.violationCount}/{db.security.maxViolationTolerance}
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              {cameraState === 'active' ? (
                <button
                  type="button"
                  onClick={resetCameraCalibration}
                  className="shrink-0 rounded-md border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300"
                >
                  Kalibrasi
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setCameraRetryNonce((n) => n + 1)}
                  className="shrink-0 rounded-md bg-indigo-600 px-2.5 py-1 text-[11px] font-semibold text-white"
                >
                  Aktifkan
                </button>
              )}
            </div>
          </div>
        )}

        {/* Question Area (Protected with Dynamic Watermark) */}
        <section
          className={`relative md:col-span-8 xl:col-span-9 md:h-full md:min-h-0 rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 p-3.5 sm:p-5 overflow-hidden flex flex-col ${
            screenshotShieldActive ? 'blur-xl brightness-0' : ''
          }`}
        >
          {/* Dynamic Anti-Photo Watermark Overlay */}
          {db.security.enableDynamicWatermark && (
            <div
              aria-hidden="true"
              data-testid="dynamic-watermark"
              className="pointer-events-none select-none absolute inset-0 z-10 overflow-hidden opacity-[0.06] dark:opacity-[0.08]"
            >
              <div className="grid grid-cols-2 gap-y-20 gap-x-10 -rotate-12 scale-110 p-6">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div
                    key={i}
                    className="font-mono text-xs font-bold tracking-wider text-slate-900 dark:text-slate-100 whitespace-nowrap"
                  >
                    {watermarkLabel}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Header Bar (Pinned inside Question Card) */}
          <div className="relative z-20 shrink-0 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-mono text-sm font-bold text-slate-900 dark:text-slate-100">
                Soal {currentIndex + 1} dari {orderedQuestions.length}
              </span>
              <span>·</span>
              <span className="font-semibold text-indigo-700 dark:text-indigo-400">
                {currentQuestion.type === 'single_choice'
                  ? 'Pilihan Ganda'
                  : currentQuestion.type === 'multiple_choice'
                    ? 'Pilihan Ganda Kompleks'
                    : currentQuestion.type === 'matching'
                      ? 'Menjodohkan'
                      : currentQuestion.type === 'essay'
                        ? 'Soal Esai (Koreksi Otomatis)'
                        : 'Benar / Salah'}
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium">
                {isOnline ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5 text-amber-600" />}
                <Save className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{lastSavedText}</span>
              </span>
              <button
                type="button"
                data-testid="student-toilet-leave-btn"
                onClick={() => {
                  setWarningModal(null);
                  setFullscreenBlockedOverlay(false);
                  requestToiletLeave(attempt.id, 'Izin ke Toilet');
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-sky-300 dark:border-sky-700 bg-sky-50 dark:bg-sky-950/50 px-2.5 py-1 text-xs font-semibold text-sky-800 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-900/50 transition-colors whitespace-nowrap"
              >
                <DoorOpen className="h-3.5 w-3.5" />
                <span>Izin</span>
              </button>
              <button
                type="button"
                onClick={() => toggleFlagQuestion(attempt.id, currentQuestion.id)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap ${
                  isCurrentFlagged
                    ? 'border-amber-400 bg-amber-100 text-amber-900 dark:border-amber-600 dark:bg-amber-950/60 dark:text-amber-300'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                <Flag className="h-3.5 w-3.5" />
                <span>{isCurrentFlagged ? 'Ragu-ragu' : 'Tandai Ragu'}</span>
              </button>
            </div>
          </div>

          {/* Question Body (Natural height on Mobile so Prev/Next stay elevated; internal scroll on Tablet/Desktop) */}
          <div className="relative z-20 md:flex-1 md:min-h-0 md:overflow-y-auto py-2.5 md:py-3 pr-0.5 md:pr-1 space-y-2.5 md:space-y-3">
            {/* Prompt & Optional Diagram */}
            <div className="space-y-2.5 md:space-y-3">
              <p className={`${fontSizeClass} font-medium text-slate-900 dark:text-slate-100`}>
                {currentQuestion.prompt}
              </p>

              {currentQuestion.imageUrl && (
                <div className="max-w-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white p-2">
                  <img
                    src={currentQuestion.imageUrl}
                    alt={`Diagram soal nomor ${currentIndex + 1}`}
                    referrerPolicy="no-referrer"
                    className="max-h-40 md:max-h-44 w-full object-contain rounded"
                  />
                </div>
              )}
            </div>

            {/* Answer Controls by Question Type */}
            <div className="pt-0.5 md:pt-1 space-y-2">
              {/* SINGLE CHOICE */}
              {currentQuestion.type === 'single_choice' && (
                <div className="space-y-2" role="radiogroup" aria-label="Pilihan jawaban">
                  {currentOptions.map((opt, displayIdx) => {
                    const displayLetter = String.fromCharCode(65 + displayIdx);
                    const selected = currentAnswer === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => handleAnswerChange(currentQuestion.id, opt.id)}
                        className={`flex w-full items-start gap-2.5 md:gap-3 rounded-xl border p-2.5 md:p-3 text-left transition-colors ${
                          selected
                            ? 'border-indigo-600 bg-indigo-50/80 text-indigo-950 dark:border-indigo-500 dark:bg-indigo-950/50 dark:text-indigo-100'
                            : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200 dark:hover:bg-slate-800'
                        }`}
                      >
                        <span
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border font-mono text-xs font-bold ${
                            selected
                              ? 'border-indigo-600 bg-indigo-600 text-white'
                              : 'border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300'
                          }`}
                        >
                          {displayLetter}
                        </span>
                        <span className={`${fontSizeClass} leading-snug`}>{opt.text}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* MULTIPLE CHOICE (KOMPLEKS) */}
              {currentQuestion.type === 'multiple_choice' && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-indigo-700 dark:text-indigo-400">
                    Pilih lebih dari satu jawaban yang menurut Anda benar:
                  </p>
                  {currentOptions.map((opt, displayIdx) => {
                    const displayLetter = String.fromCharCode(65 + displayIdx);
                    const selectedList = Array.isArray(currentAnswer) ? currentAnswer : [];
                    const checked = selectedList.includes(opt.id);
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        role="checkbox"
                        aria-checked={checked}
                        onClick={() => {
                          const next = checked
                            ? selectedList.filter((id) => id !== opt.id)
                            : [...selectedList, opt.id];
                          handleAnswerChange(currentQuestion.id, next);
                        }}
                        className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors ${
                          checked
                            ? 'border-indigo-600 bg-indigo-50/80 text-indigo-950 dark:border-indigo-500 dark:bg-indigo-950/50 dark:text-indigo-100'
                            : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200 dark:hover:bg-slate-800'
                        }`}
                      >
                        <span
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border font-mono text-xs font-bold ${
                            checked
                              ? 'border-indigo-600 bg-indigo-600 text-white'
                              : 'border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300'
                          }`}
                        >
                          {checked ? '✓' : displayLetter}
                        </span>
                        <span className={`${fontSizeClass} leading-snug`}>{opt.text}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* TRUE / FALSE */}
              {currentQuestion.type === 'true_false' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {[
                    { value: true, label: 'BENAR' },
                    { value: false, label: 'SALAH' },
                  ].map((item) => {
                    const selected = currentAnswer === item.value;
                    return (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => handleAnswerChange(currentQuestion.id, item.value)}
                        className={`rounded-xl border p-5 text-center font-bold tracking-wide transition-colors ${
                          selected
                            ? 'border-indigo-600 bg-indigo-600 text-white'
                            : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                        }`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* MATCHING */}
              {currentQuestion.type === 'matching' && currentQuestion.matchingPairs && (
                <div className="space-y-3">
                  <p className="text-xs font-medium text-indigo-700 dark:text-indigo-400">
                    Pilih pasangan jawaban yang tepat untuk setiap premis berikut:
                  </p>
                  {currentQuestion.matchingPairs.map((pair, idx) => {
                    const mapAnswer =
                      currentAnswer && typeof currentAnswer === 'object' && !Array.isArray(currentAnswer)
                        ? (currentAnswer as Record<string, string>)
                        : {};
                    return (
                      <div
                        key={pair.id}
                        className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 p-4"
                      >
                        <div className="sm:col-span-6 text-sm font-semibold text-slate-900 dark:text-slate-100">
                          <span className="font-mono text-xs text-slate-500 mr-2">
                            {idx + 1}.
                          </span>
                          {pair.left}
                        </div>
                        <div className="sm:col-span-6">
                          <select
                            aria-label={`Pasangan untuk ${pair.left}`}
                            value={mapAnswer[pair.id] || ''}
                            onChange={(e) => {
                              handleAnswerChange(currentQuestion.id, {
                                ...mapAnswer,
                                [pair.id]: e.target.value,
                              });
                            }}
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-indigo-600 focus:outline-none"
                          >
                            <option value="">-- Pilih pasangan jawaban --</option>
                            {matchingRightChoices.map((choice) => (
                              <option key={choice} value={choice}>
                                {choice}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {/* ESSAY (SOAL ESAI KOREKSI SEMANTIK OTOMATIS) */}
              {currentQuestion.type === 'essay' && (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <label
                      htmlFor={`essay-input-${currentQuestion.id}`}
                      className="font-semibold text-indigo-700 dark:text-indigo-400"
                    >
                      Tuliskan jawaban uraian Anda dengan bahasa sendiri yang jelas dan lengkap:
                    </label>
                    <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                      {typeof currentAnswer === 'string' && currentAnswer.trim()
                        ? `${currentAnswer.trim().split(/\s+/).length} kata`
                        : '0 kata'}
                    </span>
                  </div>
                  <textarea
                    id={`essay-input-${currentQuestion.id}`}
                    data-testid="essay-answer-input"
                    rows={5}
                    value={typeof currentAnswer === 'string' ? currentAnswer : ''}
                    onChange={(e) =>
                      handleAnswerChange(currentQuestion.id, e.target.value)
                    }
                    placeholder="Ketik jawaban esai Anda di sini... Sistem akan mengoreksi otomatis berdasarkan ketepatan makna jawaban."
                    className={`w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/80 p-3.5 text-slate-900 dark:text-slate-100 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20 focus:outline-none resize-none ${fontSizeClass}`}
                  />
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Jawaban esai tersimpan otomatis dan dikoreksi berdasarkan kesesuaian makna serta konsep kunci (bobot maks. {currentQuestion.points} poin).
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Prev / Next Controls (Elevated naturally on Mobile; pinned neatly inside viewport on Tablet/Desktop) */}
          <div
            data-testid="exam-nav-controls"
            className="relative z-20 shrink-0 mt-1.5 md:mt-2 flex items-center justify-between gap-2.5 border-t border-slate-100 dark:border-slate-800 pt-2.5 md:pt-3"
          >
            <button
              type="button"
              data-testid="exam-prev-btn"
              disabled={currentIndex === 0}
              onClick={() => handleSelectQuestion(currentIndex - 1)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 md:px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 disabled:opacity-40 whitespace-nowrap"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Soal Sebelumnya</span>
            </button>

            {currentIndex < orderedQuestions.length - 1 ? (
              <button
                type="button"
                data-testid="exam-next-btn"
                onClick={() => handleSelectQuestion(currentIndex + 1)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 md:px-5 py-2 text-xs font-semibold text-white hover:bg-indigo-700 whitespace-nowrap"
              >
                <span>Soal Berikutnya</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                data-testid="exam-finish-btn"
                onClick={() => {
                  setConfirmChecked(false);
                  setShowSubmitModal(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 md:px-5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 whitespace-nowrap"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>Selesaikan Ujian</span>
              </button>
            )}
          </div>
        </section>

        {/* Tablet & Desktop Question Navigator + Camera/Integrity Sidebar (Viewport-Fitted) */}
        <aside className="hidden md:flex md:col-span-4 xl:col-span-3 md:h-full md:min-h-0 flex-col gap-3 overflow-hidden">
          <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 p-3.5 flex-1 min-h-0 flex flex-col gap-2.5">
            <div className="flex items-center justify-between shrink-0">
              <h2 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                Peta Navigasi Soal
              </h2>
              <span className="font-mono text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                {answeredCount}/{orderedQuestions.length}
              </span>
            </div>

            <div className="grid grid-cols-5 gap-1.5 flex-1 min-h-0 overflow-y-auto content-start pr-0.5">
              {orderedQuestions.map((q, idx) => {
                const answered = isQuestionAnswered(q, attempt.answers[q.id]);
                const flagged = attempt.flaggedQuestionIds.includes(q.id);
                const isCurrent = idx === currentIndex;

                let cls =
                  'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300';
                if (flagged) {
                  cls =
                    'border-amber-400 bg-amber-100 text-amber-900 dark:border-amber-600 dark:bg-amber-900/50 dark:text-amber-200';
                } else if (answered) {
                  cls =
                    'border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-600';
                }
                if (isCurrent) {
                  cls += ' ring-2 ring-indigo-600 ring-offset-1 dark:ring-offset-slate-900';
                }

                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => handleSelectQuestion(idx)}
                    aria-label={`Nomor soal ${idx + 1}${answered ? ', sudah dijawab' : ', belum dijawab'}${
                      flagged ? ', ragu-ragu' : ''
                    }`}
                    className={`h-8 rounded-lg border font-mono text-xs font-bold transition-colors ${cls}`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            {/* Compact Legend */}
            <div className="shrink-0 grid grid-cols-3 gap-1 border-t border-slate-100 dark:border-slate-800 pt-2 text-[10px] text-slate-600 dark:text-slate-400">
              <div className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded bg-emerald-600 shrink-0" />
                <span>Isi ({answeredCount})</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded bg-amber-300 border border-amber-500 shrink-0" />
                <span>Ragu ({flaggedCount})</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded border border-slate-300 bg-white dark:bg-slate-800 shrink-0" />
                <span>Kosong ({unansweredCount})</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setConfirmChecked(false);
                setShowSubmitModal(true);
              }}
              className="shrink-0 w-full rounded-lg bg-slate-900 dark:bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:hover:bg-indigo-700"
            >
              Kumpulkan & Selesai Ujian
            </button>
          </div>

          {/* Compact Camera & Integrity Monitor Card */}
          <div className="shrink-0 rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 p-3 space-y-2 text-xs">
            {db.security.requireCameraMonitoring && (
              <>
                <div className="flex items-center justify-between font-semibold">
                  <span className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                    <Camera className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>Kamera Pengawas</span>
                  </span>
                  <span
                    className={`font-semibold text-[11px] ${
                      cameraState !== 'active'
                        ? 'text-rose-600 dark:text-rose-400'
                        : cameraBehaviorStatus === 'focused'
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {cameraStatusLabel}
                  </span>
                </div>

                <div className="relative h-24 w-full overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-900 flex items-center justify-center">
                  <video
                    ref={proctorVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`h-full w-full object-cover -scale-x-100 ${
                      cameraState === 'active' ? 'block' : 'hidden'
                    }`}
                  />
                  {cameraState !== 'active' && (
                    <div className="flex flex-col items-center gap-1 px-2 text-center text-slate-400">
                      <CameraOff className="h-4 w-4" />
                      <span className="text-[10px]">
                        {cameraErrorMsg || 'Menyiapkan kamera...'}
                      </span>
                    </div>
                  )}
                </div>

                {cameraState === 'active' ? (
                  <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                    <span className="inline-flex items-center gap-1">
                      {micActive ? (
                        <Mic className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <MicOff className="h-3 w-3 text-slate-400" />
                      )}
                      <span className="font-mono tabular-nums">{audioLevelPct}%</span>
                    </span>
                    <button
                      type="button"
                      onClick={resetCameraCalibration}
                      className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      Kalibrasi Wajah
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setCameraRetryNonce((n) => n + 1)}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-indigo-700"
                  >
                    <Camera className="h-3.5 w-3.5" />
                    <span>Aktifkan Ulang Kamera</span>
                  </button>
                )}
              </>
            )}

            <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-2 font-semibold text-[11px]">
              <span className="text-slate-600 dark:text-slate-400">Integritas Pelanggaran</span>
              <span
                className={`font-mono tabular-nums ${
                  attempt.violationCount > 0
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-emerald-700 dark:text-emerald-400'
                }`}
              >
                {attempt.violationCount} / {db.security.maxViolationTolerance}
              </span>
            </div>

            {db.security.requireFullscreen && !document.fullscreenElement && (
              <button
                type="button"
                onClick={requestEnterFullscreen}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-950/60 px-2.5 py-1.5 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300"
              >
                <Maximize2 className="h-3 w-3" />
                <span>Aktifkan Layar Penuh</span>
              </button>
            )}
          </div>
        </aside>
      </main>

      {/* FULL-SCREEN TOILET LEAVE MODE OVERLAY (PAUSES ALL ANTI-CHEAT DETECTIONS) */}
      {isOnToiletLeave && activeToiletRequest && (
        <div
          data-testid="toilet-leave-overlay"
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[55] flex items-center justify-center bg-slate-950/95 p-5 text-white"
        >
          <div className="w-full max-w-md rounded-2xl border border-sky-500/40 bg-slate-900 p-6 sm:p-7 text-center space-y-5 shadow-2xl">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-500/15 text-sky-400 ring-1 ring-sky-400/30">
              <DoorOpen className="h-7 w-7" />
            </div>

            <div className="space-y-1.5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-sky-400">
                Mode Izin Aktif · Pengawasan Dijeda
              </p>
              <h2 className="text-xl font-bold text-white">
                Sedang Izin ke Toilet
              </h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                Layar soal disembunyikan sementara dan seluruh deteksi pelanggaran (kamera, fokus layar, &amp; layar penuh) dihentikan sejenak selama Anda izin.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5 rounded-xl border border-slate-800 bg-slate-950/70 p-3.5 text-xs">
              <div>
                <div className="text-[11px] text-slate-400">Durasi Izin</div>
                <div className="mt-0.5 font-mono text-base font-bold text-sky-300 tabular-nums">
                  {formatSecondsToClock(
                    Math.max(
                      0,
                      Math.floor(
                        (nowMs - (Date.parse(activeToiletRequest.requestedAt) || nowMs)) /
                          1000
                      )
                    )
                  )}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400">Sisa Waktu Ujian</div>
                <div className="mt-0.5 font-mono text-base font-bold text-white tabular-nums">
                  {formatSecondsToClock(remainingSeconds)}
                </div>
              </div>
            </div>

            {activeToiletRequest.status === 'confirmed' ? (
              <div
                data-testid="toilet-leave-confirmed-status"
                className="flex items-center justify-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-950/50 px-4 py-3 text-xs font-semibold text-emerald-300"
              >
                <UserCheck className="h-4 w-4 shrink-0" />
                <span>
                  Izin dikonfirmasi oleh {activeToiletRequest.confirmedByName || 'Pengawas'}
                </span>
              </div>
            ) : (
              <div
                data-testid="toilet-leave-pending-status"
                className="flex items-center justify-center gap-2 rounded-xl border border-amber-500/40 bg-amber-950/40 px-4 py-3 text-xs font-medium text-amber-200"
              >
                <Clock className="h-4 w-4 shrink-0 text-amber-400" />
                <span>
                  Notifikasi telah dikirim ke Guru, Pengawas &amp; Admin. Menunggu konfirmasi...
                </span>
              </div>
            )}

            <button
              type="button"
              data-testid="resume-after-toilet-btn"
              onClick={() => {
                returnFromToiletLeave(activeToiletRequest.id);
                resetCameraCalibration();
                if (db.security.requireFullscreen && !document.fullscreenElement) {
                  requestEnterFullscreen();
                }
              }}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-indigo-500"
            >
              <Play className="h-4 w-4" />
              <span>Lanjutkan Menjawab Soal</span>
            </button>
          </div>
        </div>
      )}

      {/* FULL-SCREEN OPAQUE ANTI-SCREENSHOT SHIELD OVERLAY */}
      {screenshotShieldActive && !isOnToiletLeave && (
        <div
          data-testid="screenshot-shield-overlay"
          role="alert"
          className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-slate-950 p-6 text-center text-white"
        >
          <ShieldAlert className="h-14 w-14 text-rose-500 mb-3" />
          <h2 className="text-xl font-bold tracking-tight">
            TANGKAPAN LAYAR (SCREENSHOT) DIBLOKIR!
          </h2>
          <p className="mt-2 max-w-md text-xs text-slate-300 leading-relaxed">
            Sistem mendeteksi percobaan mengambil tangkapan layar. Isi soal langsung disembunyikan dan pelanggaran telah dicatat untuk pengawas.
          </p>
        </div>
      )}

      {/* Mobile Navigator Drawer (< md) */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 md:hidden flex justify-end">
          <div
            className="fixed inset-0 bg-slate-900/60"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="relative z-10 flex w-72 flex-col bg-white dark:bg-slate-900 h-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <span className="text-sm font-bold">Navigasi Soal</span>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                aria-label="Tutup navigasi soal"
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-5 gap-2 flex-1 content-start overflow-y-auto">
              {orderedQuestions.map((q, idx) => {
                const answered = isQuestionAnswered(q, attempt.answers[q.id]);
                const flagged = attempt.flaggedQuestionIds.includes(q.id);
                const isCurrent = idx === currentIndex;
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => handleSelectQuestion(idx)}
                    className={`h-10 rounded-lg border font-mono text-xs font-bold ${
                      flagged
                        ? 'border-amber-400 bg-amber-100 text-amber-900'
                        : answered
                        ? 'border-emerald-600 bg-emerald-600 text-white'
                        : 'border-slate-200 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                    } ${isCurrent ? 'ring-2 ring-indigo-600' : ''}`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => {
                setMobileNavOpen(false);
                setConfirmChecked(false);
                setShowSubmitModal(true);
              }}
              className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white"
            >
              Selesaikan Ujian
            </button>
          </div>
        </div>
      )}

      {/* RED FULLSCREEN EXIT SHIELD OVERLAY */}
      {fullscreenBlockedOverlay && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-rose-950/95 p-6 text-white"
        >
          <div className="max-w-md w-full rounded-xl border border-rose-500 bg-rose-900 p-6 space-y-4 text-center">
            <ShieldAlert className="h-12 w-12 mx-auto text-rose-200" />
            <h2 className="text-xl font-bold">Mode Layar Penuh Terputus!</h2>
            <p className="text-sm text-rose-100 leading-relaxed">
              Soal disembunyikan sementara karena Anda keluar dari mode Fullscreen. Pelanggaran telah dicatat secara otomatis ke laporan pengawas.
            </p>
            <div className="font-mono text-xs bg-rose-950/70 rounded-lg py-2 px-3">
              Peringatan Keamanan: {attempt.violationCount} / {db.security.maxViolationTolerance}
            </div>
            <button
              type="button"
              onClick={() => {
                setWarningModal(null);
                requestEnterFullscreen();
              }}
              className="w-full rounded-lg bg-white px-5 py-3 text-sm font-bold text-rose-900 hover:bg-rose-50"
            >
              Aktifkan Kembali Layar Penuh & Lanjutkan
            </button>
          </div>
        </div>
      )}

      {/* ESCALATING ANTI-CHEAT WARNING MODAL */}
      {warningModal && !fullscreenBlockedOverlay && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4"
        >
          <div className="max-w-md w-full rounded-xl border border-rose-300 bg-white dark:bg-slate-900 p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-rose-100 p-2.5 text-rose-700 shrink-0">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-mono font-bold text-rose-700">
                  PERINGATAN KEAMANAN #{warningModal.count} DARI {warningModal.maxTolerance}
                </p>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                  {warningModal.type}
                </h2>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {warningModal.detail}
            </p>

            <div className="rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 p-3 text-xs text-rose-900 dark:text-rose-200 space-y-1">
              <div>
                Waktu tercatat: <span className="font-mono font-semibold">{warningModal.timestamp}</span>
              </div>
              <div>
                {warningModal.count >= warningModal.maxTolerance
                  ? 'Ini adalah peringatan TERAKHIR. Pelanggaran berikutnya akan langsung mengunci dan mengumpulkan ujian Anda!'
                  : `Sisa toleransi sebelum ujian terkunci otomatis: ${
                      warningModal.maxTolerance - warningModal.count
                    }x pelanggaran lagi.`}
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setWarningModal(null);
                if (warningModal.requiresFullscreenReturn) {
                  requestEnterFullscreen();
                }
              }}
              className="w-full rounded-lg bg-rose-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-rose-700"
            >
              Saya Mengerti & Kembali ke Ujian
            </button>
          </div>
        </div>
      )}

      {/* TIERED SUBMIT CONFIRMATION MODAL */}
      {showSubmitModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4"
        >
          <div className="max-w-md w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {examPackage.category === 'Latihan Mandiri'
                  ? 'Konfirmasi Penyelesaian Latihan'
                  : 'Konfirmasi Penyelesaian Ujian'}
              </h2>
              <button
                type="button"
                onClick={() => setShowSubmitModal(false)}
                aria-label="Tutup dialog selesai"
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-3 text-center text-xs">
              <div>
                <div className="text-slate-500">Terjawab</div>
                <div className="font-mono text-base font-bold text-emerald-700 dark:text-emerald-400">
                  {answeredCount}
                </div>
              </div>
              <div>
                <div className="text-slate-500">Ragu-ragu</div>
                <div className="font-mono text-base font-bold text-amber-600">
                  {flaggedCount}
                </div>
              </div>
              <div>
                <div className="text-slate-500">Kosong</div>
                <div className="font-mono text-base font-bold text-rose-600">
                  {unansweredCount}
                </div>
              </div>
            </div>

            {minSubmitRemainingSeconds > 0 ? (
              <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/50 p-3.5 text-xs text-amber-900 dark:text-amber-200">
                <Lock className="h-4 w-4 shrink-0 mt-0.5 text-amber-700" />
                <div>
                  <div className="font-bold">Tombol Selesai Masih Terkunci</div>
                  <p className="mt-0.5">
                    Guru mengatur batas minimal waktu pengerjaan ({examPackage.minSubmitMinutes} menit). Anda baru dapat mengumpulkan dalam{' '}
                    <span className="font-mono font-bold tabular-nums">
                      {formatSecondsToClock(minSubmitRemainingSeconds)}
                    </span>
                    .
                  </p>
                </div>
              </div>
            ) : (
              <label className="flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmChecked}
                  onChange={(e) => setConfirmChecked(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-400 text-indigo-600"
                />
                <span className="font-medium">
                  {examPackage.category === 'Latihan Mandiri'
                    ? 'Saya yakin telah memeriksa semua jawaban dan bersedia menyelesaikan latihan sekarang.'
                    : 'Saya yakin telah memeriksa semua jawaban dan bersedia mengumpulkan ujian sekarang.'}
                </span>
              </label>
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowSubmitModal(false)}
                className="rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200"
              >
                Periksa Lagi
              </button>
              <button
                type="button"
                disabled={minSubmitRemainingSeconds > 0 || !confirmChecked}
                onClick={() => {
                  setShowSubmitModal(false);
                  submitStudentExam(attempt.id);
                }}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
              >
                {examPackage.category === 'Latihan Mandiri'
                  ? 'Selesaikan Latihan'
                  : 'Kumpulkan Ujian'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
