import { AlertDialog } from 'radix-ui';
import { useEffect, useRef, useState } from 'react';

import {
  clearAnalyticsCookies,
  isAnalyticsEnabled,
  loadAnalytics,
} from '../../analytics/analytics';
import { type ConsentChoice, setConsent, useConsent } from '../../consent/consent';
import { Button } from '../ui/Button/Button';
import styles from './CookieBanner.module.scss';

/** Blocks the page until the visitor decides, and loads GA4 only once consent is granted. */
export function CookieBanner() {
  const consent = useConsent();
  const enabled = isAnalyticsEnabled();
  const [nudging, setNudging] = useState(false);
  const acceptRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (enabled && consent === 'granted') loadAnalytics();
  }, [enabled, consent]);

  if (!enabled || consent !== null) return null;

  const choose = (choice: ConsentChoice) => {
    const wasLoaded = Boolean(window.gtag);
    setConsent(choice);

    // GA4 cannot be unloaded, so a withdrawn consent clears its cookies and reloads.
    if (choice === 'denied' && wasLoaded) {
      clearAnalyticsCookies();
      window.location.reload();
    }
  };

  const focusAccept = () => acceptRef.current?.focus();

  // Restarts the pop animation and puts the focus back on Accept.
  const nudge = () => {
    focusAccept();
    setNudging(false);
    requestAnimationFrame(() => setNudging(true));
  };

  return (
    <AlertDialog.Root open>
      <AlertDialog.Portal>
        <AlertDialog.Overlay
          className={styles.overlay}
          onPointerDown={(event) => {
            event.preventDefault();
            nudge();
          }}
        />
        <AlertDialog.Content
          className={styles.root}
          data-nudge={nudging ? '' : undefined}
          onAnimationEnd={() => setNudging(false)}
          // Clicks on the text keep the focus on Accept; the buttons work as usual.
          onPointerDown={(event) => {
            if ((event.target as HTMLElement).closest('button')) return;
            event.preventDefault();
            focusAccept();
          }}
          // Focus Accept instead of Radix's default (Cancel), so Enter accepts.
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            focusAccept();
          }}
          onEscapeKeyDown={(event) => {
            event.preventDefault();
            nudge();
          }}
        >
          <AlertDialog.Title className={styles.title}>Cookies</AlertDialog.Title>
          <AlertDialog.Description className={styles.text}>
            Usamos Google Analytics para saber cuánta gente usa la web y cómo, y así mejorarla. Solo
            se activa si aceptas. Las preferencias de la web, como el tema, se guardan en tu
            dispositivo y no salen de él.
          </AlertDialog.Description>
          <div className={styles.actions}>
            <AlertDialog.Cancel asChild>
              <Button onClick={() => choose('denied')}>Rechazar</Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button ref={acceptRef} variant="primary" onClick={() => choose('granted')}>
                Aceptar
              </Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
