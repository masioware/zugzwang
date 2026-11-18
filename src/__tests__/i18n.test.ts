import { describe, expect, it } from 'vitest';
import en from '../i18n/en.json';
import pt from '../i18n/pt-BR.json';

/** Dotted paths of every string in a translation tree. */
function keys(tree: unknown, prefix = ''): string[] {
  if (typeof tree === 'string') return [prefix];
  if (tree && typeof tree === 'object') return Object.entries(tree).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k));
  return [];
}

const section = (tree: Record<string, unknown>, name: string) => keys(tree[name], name);

describe('translations', () => {
  it('has the same keys in both languages for the stats navigation and the style page', () => {
    for (const name of ['statsNav', 'style', 'train']) {
      expect(section(pt, name).sort(), name).toEqual(section(en, name).sort());
    }
  });

  it('names the style tab and its question (without them the tab shows its raw key)', () => {
    for (const tree of [en, pt] as { statsNav: Record<string, string> }[]) {
      expect(tree.statsNav.style).toBeTruthy();
      expect(tree.statsNav.styleQuestion).toBeTruthy();
    }
  });

  it('keeps interpolation placeholders consistent between languages', () => {
    const get = (tree: unknown, path: string) => path.split('.').reduce<unknown>((t, k) => (t as Record<string, unknown>)[k], tree) as string;
    const holes = (s: string) => [...s.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort();
    for (const path of [...section(en, 'style'), ...section(en, 'train')]) expect(holes(get(pt, path)), path).toEqual(holes(get(en, path)));
  });
});
