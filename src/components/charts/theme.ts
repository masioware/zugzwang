import type { TimeClass } from '../../types';

/** Validated categorical slots for the dark surface, assigned in fixed order. */
export const SERIES = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181'];

/** Each time control always keeps the same hue, whatever is filtered. */
export const TIME_CLASS_COLOR: Record<TimeClass, string> = {
  bullet: SERIES[0],
  blitz: SERIES[1],
  rapid: SERIES[2],
  classical: SERIES[3],
  daily: SERIES[4],
};

export const WDL_COLOR = { win: '#3987e5', draw: '#6f6f78', loss: '#e66767' };

/** Ordinal ramp for error severity (light → dark). */
export const SEVERITY = { inaccuracy: '#f2b48c', mistake: '#e07a45', blunder: '#a8441c' };

/** Chart surface (the panel) — also the colour of the 2px gaps and rings between marks. */
export const SURFACE = '#121215';
export const INK = '#f6f5f1';
export const MUTED = '#7a7a80';
/** Brand yellow: the "you are here" marker (current ply, selection), never a data series. */
export const HIGHLIGHT = '#ffd60a';

export const AXIS = { stroke: '#2f2f36', tick: { fill: MUTED, fontSize: 11, fontVariantNumeric: 'tabular-nums' } };
export const GRID = '#232328';
