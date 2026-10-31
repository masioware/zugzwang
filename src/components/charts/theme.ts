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

export const WDL_COLOR = { win: '#3987e5', draw: '#6b6a65', loss: '#e66767' };

/** Ordinal ramp for error severity (light → dark). */
export const SEVERITY = { inaccuracy: '#f2b48c', mistake: '#e07a45', blunder: '#a8441c' };

export const AXIS = { stroke: '#5a5855', tick: { fill: '#8b8987', fontSize: 11 } };
export const GRID = '#3c3a37';
