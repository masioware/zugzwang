import { describe, expect, it } from 'vitest';
import { filtersFromParams, sameFilters, writeFilterParams } from '../lib/filterParams';
import { DEFAULT_FILTERS, type Filters } from '../stats/aggregate';

describe('filter params', () => {
  it('is null when the URL names no filter', () => {
    expect(filtersFromParams(new URLSearchParams('page=2'))).toBeNull();
  });

  it('round-trips, leaving defaults and other params alone', () => {
    const f: Filters = { ...DEFAULT_FILTERS, timeClass: 'blitz', color: 'black', period: 30, search: 'sicilian' };
    const params = writeFilterParams(new URLSearchParams('page=2'), f);
    expect(params.toString()).toBe('page=2&time=blitz&color=black&period=30&q=sicilian');
    expect(filtersFromParams(params)).toEqual(f);
  });

  it('drops filters set back to the default', () => {
    const params = writeFilterParams(new URLSearchParams('time=blitz&q=x'), DEFAULT_FILTERS);
    expect(params.toString()).toBe('');
  });

  it('ignores unknown values', () => {
    expect(filtersFromParams(new URLSearchParams('time=hyper&period=7&result=loss'))).toEqual({ ...DEFAULT_FILTERS, outcome: 'loss' });
  });

  it('compares field by field', () => {
    expect(sameFilters({ ...DEFAULT_FILTERS }, DEFAULT_FILTERS)).toBe(true);
    expect(sameFilters({ ...DEFAULT_FILTERS, rated: 'casual' }, DEFAULT_FILTERS)).toBe(false);
  });
});
