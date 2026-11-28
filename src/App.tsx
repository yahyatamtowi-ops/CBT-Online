/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import { LandingPortal } from './components/LandingPortal';
import { OfflineStatusBanner } from './components/OfflineStatusBanner';
import { OpeningSplash } from './components/OpeningSplash';
import { TransitionLoader } from './components/TransitionLoader';
import { AdminPortal } from './components/admin/AdminPortal';
import { ProctorPortal } from './components/proctor/ProctorPortal';
import { StudentPortal } from './components/student/StudentPortal';
import { TeacherPortal } from './components/teacher/TeacherPortal';
import { CBTProvider, useCBT } from './context/CBTContext';
import { FirestoreErrorBoundary } from './components/FirestoreErrorBoundary';
import { registerExamServiceWorker } from './utils/offlineExamCache';

function shouldSkipIntro(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.get('autostart') === '1';
}

function PortalRouter() {
  const { db, session, transitionOverlay } = useCBT();
  const [showSplash, setShowSplash] = useState<boolean>(() => !shouldSkipIntro());

  const handleSplashComplete = useCallback(() => {
    setShowSplash(false);
  }, []);

  let activePortal: React.ReactNode;
  if (!session) {
    activePortal = <LandingPortal />;
  } else if (session.role === 'admin') {
    activePortal = <AdminPortal />;
  } else if (session.role === 'teacher') {
    activePortal = <TeacherPortal />;
  } else if (session.role === 'proctor') {
    activePortal = <ProctorPortal />;
  } else {
    activePortal = <StudentPortal />;
  }

  return (
    <>
      {activePortal}
      <OfflineStatusBanner />
      {showSplash && (
        <OpeningSplash
          logoUrl={db.school.logoUrl}
          schoolName={db.school.schoolName}
          onComplete={handleSplashComplete}
        />
      )}
      <TransitionLoader
        overlay={transitionOverlay}
        logoUrl={db.school.logoUrl}
        schoolName={db.school.schoolName}
      />
    </>
  );
}

export default function App() {
  useEffect(() => {
    void registerExamServiceWorker();
  }, []);

  return (
    <FirestoreErrorBoundary>
      <CBTProvider>
        <PortalRouter />
      </CBTProvider>
    </FirestoreErrorBoundary>
  );
}
