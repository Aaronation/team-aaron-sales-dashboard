import { describePace, describeRunRate, paceLabel, shareOfTargetLabel, type WorkingDayForecast } from '../lib/forecast'
import { formatMoney } from '../lib/aggregates'

type Props = {
  monthLabel: string
  throughLabel: string
  targetLabel: string
  scopeNote: string
  result: WorkingDayForecast
}

export function ForecastPanel({ monthLabel, throughLabel, targetLabel, scopeNote, result }: Props) {
  const share = shareOfTargetLabel(result.mtdRevenue, result.target)
  const holidayNote = result.holidaysLoaded ? 'HK public holidays excluded.' : 'Weekends excluded.'
  const paceClass =
    result.pace === 'on-track' ? 'pace pace--on-track' : result.pace === 'behind' ? 'pace pace--behind' : 'pace'

  return (
    <section className="forecast" aria-label="Targets and forecast">
      <header>
        <h2>Targets and forecast</h2>
        <p>
          {monthLabel} · {result.elapsedWorkingDays} of {result.totalWorkingDays} working days through{' '}
          {throughLabel}. {holidayNote}
        </p>
        <p className="forecast__note">{scopeNote}</p>
      </header>
      <div className="forecast__grid">
        <div>
          <p className="kpis__label">{targetLabel}</p>
          <p className="kpis__value">{result.target > 0 ? formatMoney(result.target) : '—'}</p>
          <p className="kpis__hint">{result.target > 0 ? monthLabel : 'No split of the team target.'}</p>
        </div>
        <div>
          <p className="kpis__label">MTD sell-out</p>
          <p className="kpis__value">{formatMoney(result.mtdRevenue)}</p>
          <p className="kpis__hint">{share ?? 'No target for this view.'}</p>
        </div>
        <div>
          <p className="kpis__label">Pace</p>
          <p className={`kpis__value ${paceClass}`}>{paceLabel(result.pace)}</p>
          <p className="kpis__hint">{describePace(result)}</p>
        </div>
        <div>
          <p className="kpis__label">Forecast</p>
          <p className="kpis__value">{result.forecast == null ? '—' : formatMoney(result.forecast)}</p>
          <p className="kpis__hint">{describeRunRate(result, throughLabel)}</p>
        </div>
      </div>
    </section>
  )
}
