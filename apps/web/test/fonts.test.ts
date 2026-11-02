import { describe, expect, it } from 'vitest';
import { GET as getFont } from '@/app/fonts/[file]/route';
import { params, request } from './helpers';

describe('font files', () => {
  it('serves interior fonts to anyone and nothing else', async () => {
    const res = await getFont(request('/fonts/Lato-Regular.ttf'), params({ file: 'Lato-Regular.ttf' }));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('font/ttf');
    expect([...new Uint8Array(await res.arrayBuffer()).slice(0, 4)]).toEqual([0, 1, 0, 0]);

    for (const file of ['../../../.env', 'OFL.txt', 'licenses/lato-OFL.txt']) {
      expect((await getFont(request('/x'), params({ file }))).status, file).toBe(404);
    }
  });
});
