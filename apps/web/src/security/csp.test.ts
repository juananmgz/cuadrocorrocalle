import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { expect, test } from 'vitest';

const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');

test('the CSP allows the inline theme script in index.html', () => {
  const html = read('../../index.html');
  const headers = read('../../public/_headers');
  const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]!);

  expect(inline).toHaveLength(1);
  const hash = createHash('sha256').update(inline[0]!).digest('base64');
  expect(headers).toContain(`'sha256-${hash}'`);
});
