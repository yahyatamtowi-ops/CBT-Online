import React, { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';

export function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY > 220);
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      data-testid="scroll-to-top-btn"
      aria-label="Gulir ke atas"
      title="Gulir ke atas"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className="fixed bottom-24 right-3.5 sm:bottom-20 sm:right-5 lg:bottom-16 lg:right-6 z-30 inline-flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600/95 text-white shadow-md shadow-indigo-900/20 hover:bg-indigo-700 active:scale-95 transition-all border border-indigo-400/30"
    >
      <ArrowUp className="h-4 w-4" />
    </button>
  );
}
