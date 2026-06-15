'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function PWARegister() {
  const [installEvent, setInstallEvent] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSHelp, setShowIOSHelp] = useState(false);

  useEffect(() => {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(()=>{});
    }

    // Detect iOS for manual install help
    const ua = navigator.userAgent || '';
    const ios = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
    const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    setIsIOS(ios);

    const dismissed = localStorage.getItem('om_pwa_dismissed_at');
    const recentlyDismissed = dismissed && (Date.now() - Number(dismissed)) < 7 * 24 * 60 * 60 * 1000;

    if (ios && !standalone && !recentlyDismissed) {
      setTimeout(() => setShowIOSHelp(true), 3000);
    }

    const handler = (e) => {
      e.preventDefault();
      setInstallEvent(e);
      if (!recentlyDismissed && !standalone) setShowPrompt(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const install = async () => {
    if (!installEvent) return;
    installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    if (outcome === 'accepted') {
      setShowPrompt(false);
    }
    setInstallEvent(null);
  };

  const dismiss = () => {
    localStorage.setItem('om_pwa_dismissed_at', String(Date.now()));
    setShowPrompt(false);
    setShowIOSHelp(false);
  };

  return (
    <AnimatePresence>
      {(showPrompt || showIOSHelp) && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:bottom-6 md:max-w-sm z-[60] rounded-xl border border-border bg-card/95 backdrop-blur p-4 shadow-2xl"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-foreground text-background flex items-center justify-center font-bold shrink-0">OM</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">Install ONEMISSION HQ</p>
              {showIOSHelp ? (
                <p className="text-xs text-muted-foreground mt-1">Tap <span className="font-medium text-foreground">Share</span> &rarr; <span className="font-medium text-foreground">Add to Home Screen</span> to install as an app.</p>
              ) : (
                <p className="text-xs text-muted-foreground mt-1">Add to home screen for full-screen, app-like access.</p>
              )}
              <div className="flex gap-2 mt-3">
                {!showIOSHelp && (
                  <Button size="sm" onClick={install} className="gap-1.5 h-8"><Download className="h-3.5 w-3.5" /> Install</Button>
                )}
                <Button size="sm" variant="ghost" onClick={dismiss} className="h-8">Not now</Button>
              </div>
            </div>
            <button onClick={dismiss} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
