import { useState } from 'react'
import { IMPORT_COLUMN_HINT, type ImportMode } from '../lib/ingest'

type Props = {
  busy: boolean
  note: string | null
  error: string | null
  onImportFile: (file: File, mode: ImportMode) => void
  onLoadSample: (mode: ImportMode) => void
  onReset: () => void
  saved: boolean
}

export function ImportPanel({ busy, note, error, onImportFile, onLoadSample, onReset, saved }: Props) {
  const [mode, setMode] = useState<ImportMode>('merge')

  return (
    <section className="import-panel" aria-label="Import raw data">
      <header>
        <h2>Import raw data</h2>
        <p>
          Upload a Kingdee-style CSV or Excel export to update the dashboard. Merge and Replace
          are saved in this browser and come back after a refresh. Reset to seed clears that
          save and reloads the bundled file. Auto-sync is not connected; this uses the same
          ingest a future sync would call.
        </p>
      </header>
      <div className="import-panel__controls">
        <label className="import-panel__file">
          <span>Upload CSV, Excel, or JSON</span>
          <input
            type="file"
            accept=".csv,.txt,.xlsx,.xlsm,.json,text/csv,application/json"
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (file) onImportFile(file, mode)
            }}
          />
        </label>
        <fieldset className="import-panel__mode">
          <legend>Apply as</legend>
          <label>
            <input
              type="radio"
              name="import-mode"
              value="merge"
              checked={mode === 'merge'}
              onChange={() => setMode('merge')}
            />
            Merge into current
          </label>
          <label>
            <input
              type="radio"
              name="import-mode"
              value="replace"
              checked={mode === 'replace'}
              onChange={() => setMode('replace')}
            />
            Replace all
          </label>
        </fieldset>
        <button type="button" disabled={busy} onClick={() => onLoadSample(mode)}>
          {busy ? 'Working…' : 'Load sample export'}
        </button>
        <button type="button" disabled={busy} onClick={onReset}>
          Reset to seed
        </button>
      </div>
      <p className="import-panel__hint">{IMPORT_COLUMN_HINT}</p>
      {error ? (
        <p className="import-panel__error" role="alert">
          {error}
        </p>
      ) : null}
      {note ? <p className="import-panel__note">{note}</p> : null}
      {saved ? <p className="import-panel__saved">Working set saved in this browser.</p> : null}
    </section>
  )
}
