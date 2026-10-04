type Gtag = (...args: unknown[]) => void;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: Gtag;
  }
}

export const MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID;

const SCRIPT_ID = 'ga4-script';

export function isAnalyticsEnabled() {
  return Boolean(MEASUREMENT_ID);
}

/** Injects the GA4 tag once. Only call it after the visitor grants consent. */
export function loadAnalytics(id = MEASUREMENT_ID) {
  if (!id || document.getElementById(SCRIPT_ID)) return;

  window.dataLayer = window.dataLayer ?? [];
  window.gtag = function gtag() {
    // gtag.js expects the arguments object, not an array.
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };

  window.gtag('consent', 'default', {
    analytics_storage: 'granted',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  });
  window.gtag('js', new Date());
  // Page views on route changes come from GA4 enhanced measurement (history events).
  window.gtag('config', id);

  const script = document.createElement('script');
  script.id = SCRIPT_ID;
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.append(script);
}

/** Stops GA4 on this page and deletes its _ga cookies. */
export function clearAnalyticsCookies(id = MEASUREMENT_ID) {
  // Disable the tag first so it does not write the cookies again before the reload.
  if (id) (window as unknown as Record<string, boolean>)[`ga-disable-${id}`] = true;
  window.gtag?.('consent', 'update', { analytics_storage: 'denied' });

  const host = window.location.hostname;
  const domains = ['', host, `.${host}`, `.${host.split('.').slice(-2).join('.')}`];

  document.cookie
    .split(';')
    .map((cookie) => cookie.split('=')[0]!.trim())
    .filter((name) => name === '_ga' || name.startsWith('_ga_'))
    .forEach((name) => {
      domains.forEach((domain) => {
        const domainPart = domain ? `; domain=${domain}` : '';
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${domainPart}`;
      });
    });
}
