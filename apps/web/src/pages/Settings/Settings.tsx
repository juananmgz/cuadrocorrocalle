import { RadioGroup } from 'radix-ui';

import { isAnalyticsEnabled } from '../../analytics/analytics';
import { Button } from '../../components/ui/Button/Button';
import { Card } from '../../components/ui/Card/Card';
import { resetConsent } from '../../consent/consent';
import { THEME_OPTIONS, type ThemePreference, useThemePreference } from '../../theme/theme';
import styles from './Settings.module.scss';

export function Settings() {
  const [theme, setTheme] = useThemePreference();

  return (
    <>
      <h1 className={styles.title}>Ajustes</h1>
      <Card title="Tema">
        <RadioGroup.Root
          className={styles.themes}
          aria-label="Tema"
          orientation="horizontal"
          value={theme}
          onValueChange={(value) => setTheme(value as ThemePreference)}
        >
          {THEME_OPTIONS.map((option) => (
            <RadioGroup.Item key={option.value} value={option.value} className={styles.theme}>
              {option.label}
            </RadioGroup.Item>
          ))}
        </RadioGroup.Root>
      </Card>
      {isAnalyticsEnabled() && (
        <Card title="Cookies">
          <p className={styles.text}>Vuelve a elegir si aceptas Google Analytics.</p>
          <Button onClick={resetConsent}>Preferencias de cookies</Button>
        </Card>
      )}
    </>
  );
}
