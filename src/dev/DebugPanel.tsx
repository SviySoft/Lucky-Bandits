import type { GameEngine, GameSnapshot } from '../game/GameEngine';
import type { ForceMode } from '../game/types';
import { SYMBOLS } from '../game/config/symbols';
import { formatMoney } from '../game/config/game-config';

interface Props {
  engine: GameEngine;
  snapshot: GameSnapshot;
  onClose: () => void;
}

const FORCES: { label: string; mode: ForceMode }[] = [
  { label: '3 SCATTER', mode: 'SCATTER_3' },
  { label: '4 SCATTER', mode: 'SCATTER_4' },
  { label: '5 SCATTER', mode: 'SCATTER_5' },
  { label: 'FREE SPINS', mode: 'FREE_SPINS' },
  { label: 'WILD LINE', mode: 'WILD' },
  { label: 'BIG WIN', mode: 'BIG_WIN' },
];

/**
 * Debug panel — development builds only (guarded by `__DEV_TOOLS__`, so the whole
 * module is dropped from the production bundle by tree shaking).
 */
export function DebugPanel({ engine, snapshot, onClose }: Props) {
  const record = snapshot.lastRecord;
  const outcome = record?.outcome;
  const force = engine.getForceMode();

  const row = (label: string, value: string | number, keyPrefix = '') => (
    <div className="debug-row" key={`${keyPrefix}${label}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );

  return (
    <div className="debug-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ letterSpacing: '0.2em' }}>DEBUG</strong>
        <button className="debug-btn" onClick={onClose} style={{ padding: '4px 10px' }}>
          CLOSE
        </button>
      </div>

      <h4>Session</h4>
      {row('state', snapshot.state)}
      {row('session', snapshot.sessionId.slice(0, 22))}
      {row('spins', snapshot.spinCount, 'session-')}
      {row('balance', formatMoney(snapshot.balance))}
      {row('bet', formatMoney(snapshot.bet))}
      {row('turbo', String(snapshot.turbo))}
      {row('autoplay', snapshot.autoplay.active ? String(snapshot.autoplay.remaining) : 'off')}

      <h4>Free spins</h4>
      {row('active', String(snapshot.freeSpins.active), 'fs-')}
      {row('spins', `${snapshot.freeSpins.spinsUsed} / ${snapshot.freeSpins.spinsTotal}`, 'fs-')}
      {row('sticky wilds', snapshot.freeSpins.stickyWilds.length)}
      {row('bonus win', formatMoney(snapshot.freeSpins.totalWin))}

      <h4>Last RNG result</h4>
      {outcome ? (
        <>
          {row('reel stops', outcome.stops.join(' · '))}
          <div className="debug-grid">
            {[0, 1, 2].map((rowIndex) =>
              [0, 1, 2, 3, 4].map((reel) => (
                <div className="debug-cell" key={`${reel}-${rowIndex}`}>
                  {SYMBOLS[outcome.grid[reel][rowIndex]].label.slice(0, 4)}
                </div>
              )),
            )}
          </div>
          {row('scatters', outcome.scatter.count)}
          {row('anticipation', outcome.anticipation.map((a) => (a ? '1' : '0')).join(''))}
          {row(
            'wild mult',
            outcome.wilds.length ? outcome.wilds.map((w) => `r${w.reel + 1}:x${w.multiplier}`).join(' ') : '—',
          )}
          {row('line win', formatMoney(outcome.lineWin))}
          {row('scatter win', formatMoney(outcome.scatter.win))}
          {row('total win', formatMoney(outcome.totalWin))}
          {row('tier', record?.tier ?? '—')}
          <h4>Active paylines</h4>
          {outcome.lineWins.length === 0
            ? row('—', 'no winning lines', 'lines-')
            : outcome.lineWins.map((win) =>
                row(
                  `line ${win.lineIndex + 1}`,
                  `${win.count}x ${win.symbol} = ${formatMoney(win.baseWin)} x${win.multiplier} → ${formatMoney(win.win)}`,
                ),
              )}
        </>
      ) : (
        row('—', 'no spin yet', 'empty-')
      )}

      <h4>Force next spin</h4>
      <div className="debug-actions">
        {FORCES.map((item) => (
          <button
            key={item.mode}
            className={`debug-btn${force === item.mode ? ' is-armed' : ''}`}
            onClick={() => engine.setForceMode(force === item.mode ? 'NONE' : item.mode)}
          >
            {item.label}
          </button>
        ))}
        <button className="debug-btn" onClick={() => engine.topUp(1000)}>
          +1000 CREDITS
        </button>
        <button className="debug-btn" onClick={() => engine.setForceMode('NONE')}>
          CLEAR FORCE
        </button>
      </div>
      <div style={{ marginTop: 8, opacity: 0.7 }}>Ctrl + Shift + D toggles this panel.</div>
    </div>
  );
}
