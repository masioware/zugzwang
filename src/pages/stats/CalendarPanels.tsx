import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Block, Panel } from './layout';
import { NeedsAnalysis, type StatsData } from './shared';
import ValueBars from '../../components/charts/ValueBars';
import StackedResults from '../../components/charts/StackedResults';
import { CalendarIcon, ClockIcon, MoonIcon, SunIcon, SunriseIcon, SunsetIcon } from '../../components/icons';
import { byDayPart, byWeekday } from '../../stats/insights';

const DAY_PART_ICON = {
  night: <MoonIcon className="h-5 w-5 text-[#9085e9]" />,
  morning: <SunriseIcon className="h-5 w-5 text-[#3987e5]" />,
  afternoon: <SunIcon className="h-5 w-5 text-[#c98500]" />,
  evening: <SunsetIcon className="h-5 w-5 text-[#d95926]" />,
};

export function TimeOfDayPanel({ games, analyses, analysedCount }: StatsData) {
  const { t } = useTranslation();
  const rows = useMemo(() => byDayPart(games, analyses), [games, analyses]);
  const label = (k: string) => t(`dayPart.${k}`);
  const tick = (k: string) => DAY_PART_ICON[k as keyof typeof DAY_PART_ICON];

  return (
    <Panel id="timeOfDay" icon={ClockIcon}>
      <Block title={t('stats.gamesByDayPart')} subtitle={t('stats.dayPartHint')}>
        <ValueBars
          rows={rows.map((r) => ({ key: r.key, value: r.games }))}
          label={label}
          tick={tick}
          format={(v) => String(v)}
          domain={[0, 'auto']}
          seriesLabel={t('common.games')}
          height={180}
        />
      </Block>
      <Block title={t('stats.accuracyByDayPart')}>
        {!analysedCount ? (
          <NeedsAnalysis />
        ) : (
          <ValueBars
            rows={rows.map((r) => ({ key: r.key, value: r.accuracy, note: t('games.count', { count: r.analysed }) }))}
            label={label}
            tick={tick}
            seriesLabel={t('common.accuracy')}
            highlightExtremes
          />
        )}
      </Block>
      <Block title={t('stats.resultsByDayPart')}>
        <StackedResults rows={rows} label={label} tick={tick} />
      </Block>
    </Panel>
  );
}

export function WeekdayPanel({ games, analyses, analysedCount }: StatsData) {
  const { t, i18n } = useTranslation();
  const rows = useMemo(() => byWeekday(games, analyses), [games, analyses]);
  // 7 Jan 2024 was a Sunday, so day i of that week has getDay() === i.
  const fmt = new Intl.DateTimeFormat(i18n.resolvedLanguage, { weekday: 'short' });
  const label = (k: string) => {
    const s = fmt.format(new Date(2024, 0, 7 + Number(k))).replace(/\.$/, '');
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  return (
    <Panel id="weekday" icon={CalendarIcon}>
      <Block title={t('stats.gamesByWeekday')}>
        <ValueBars
          rows={rows.map((r) => ({ key: r.key, value: r.games }))}
          label={label}
          format={(v) => String(v)}
          domain={[0, 'auto']}
          seriesLabel={t('common.games')}
          height={180}
        />
      </Block>
      <Block title={t('stats.accuracyByWeekday')}>
        {!analysedCount ? (
          <NeedsAnalysis />
        ) : (
          <ValueBars rows={rows.map((r) => ({ key: r.key, value: r.accuracy, note: t('games.count', { count: r.analysed }) }))} label={label} seriesLabel={t('common.accuracy')} highlightExtremes />
        )}
      </Block>
      <Block title={t('stats.resultsByWeekday')}>
        <StackedResults rows={rows} label={label} />
      </Block>
    </Panel>
  );
}
