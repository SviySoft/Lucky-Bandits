import { useEffect, useState } from 'react';
import { Modal } from './Modal';
import type { GameEngine } from '../game/GameEngine';
import type { SpinRecord } from '../game/types';
import { formatMoney } from '../game/config/game-config';
import { SYMBOLS } from '../game/config/symbols';

interface Props {
  engine: GameEngine;
  onClose: () => void;
}

function SpinDetail({ record }: { record: SpinRecord }) {
  const winning = new Set<string>();
  record.outcome.lineWins.forEach((w) => w.positions.forEach((p) => winning.add(`${p.reel}:${p.row}`)));
  record.outcome.scatter.positions.forEach((p) => winning.add(`${p.reel}:${p.row}`));

  return (
    <div className="history-detail">
      <div className="mini-grid">
        {[0, 1, 2].map((row) =>
          [0, 1, 2, 3, 4].map((reel) => {
            const symbol = record.outcome.grid[reel][row];
            const wild = record.outcome.wilds.find((w) => w.reel === reel && w.row === row);
            return (
              <div
                key={`${reel}-${row}`}
                className={`mini-cell${winning.has(`${reel}:${row}`) ? ' is-win' : ''}`}
                title={SYMBOLS[symbol].name}
              >
                {SYMBOLS[symbol].label.slice(0, 5)}
                {wild && wild.multiplier > 1 ? `×${wild.multiplier}` : ''}
              </div>
            );
          }),
        )}
      </div>

      <div className="kv">
        <div>
          <span>Spin ID</span>
          <b style={{ fontSize: 10 }}>{record.spinId}</b>
        </div>
        <div>
          <span>Time</span>
          <b>{new Date(record.timestamp).toLocaleTimeString()}</b>
        </div>
        <div>
          <span>Mode</span>
          <b>{record.freeSpin ? 'Free spin' : 'Base game'}</b>
        </div>
        <div>
          <span>Bet</span>
          <b>{formatMoney(record.bet)}</b>
        </div>
        <div>
          <span>Win</span>
          <b>{formatMoney(record.totalWin)}</b>
        </div>
        <div>
          <span>Balance before</span>
          <b>{formatMoney(record.balanceBefore)}</b>
        </div>
        <div>
          <span>Balance after</span>
          <b>{formatMoney(record.balanceAfter)}</b>
        </div>
        <div>
          <span>Winning lines</span>
          <b>{record.outcome.lineWins.length}</b>
        </div>
        <div>
          <span>Scatters</span>
          <b>{record.scatterCount}</b>
        </div>
        <div>
          <span>Multipliers</span>
          <b>{record.multipliers.length ? record.multipliers.map((m) => `x${m}`).join(' ') : '—'}</b>
        </div>
        <div>
          <span>Reel stops</span>
          <b>{record.outcome.stops.join(' · ')}</b>
        </div>
        <div>
          <span>Transactions</span>
          <b style={{ fontSize: 10 }}>{record.transactionIds.length}</b>
        </div>
      </div>

      {record.outcome.lineWins.length > 0 && (
        <div style={{ marginTop: 10 }}>
          {record.outcome.lineWins.map((win, i) => (
            <div className="pay-row" key={i}>
              <span>
                Line {win.lineIndex + 1} · {win.count} × {SYMBOLS[win.symbol].name}
                {win.multiplier > 1 ? ` · x${win.multiplier}` : ''}
              </span>
              <b>{formatMoney(win.win)}</b>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function GameHistory({ engine, onClose }: Props) {
  const [records, setRecords] = useState<SpinRecord[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    void engine.getHistory(60).then(setRecords);
  }, [engine]);

  return (
    <Modal title="Game history" onClose={onClose}>
      {records.length === 0 ? (
        <div className="empty-state">No spins yet — press SPIN to start the heist.</div>
      ) : (
        <div className="history-list">
          {records.map((record) => (
            <div key={record.spinId}>
              <button
                className={`history-row${openId === record.spinId ? ' is-open' : ''}`}
                onClick={() => setOpenId(openId === record.spinId ? null : record.spinId)}
              >
                <span className="history-row__id">
                  {new Date(record.timestamp).toLocaleTimeString()}
                  <br />
                  {record.freeSpin ? 'FREE' : 'BASE'}
                </span>
                <span className="history-row__meta">
                  Bet {formatMoney(record.bet)} · {record.outcome.lineWins.length} line
                  {record.outcome.lineWins.length === 1 ? '' : 's'}
                  {record.scatterCount >= 3 ? ` · ${record.scatterCount} scatters` : ''}
                  {record.tier !== 'NONE' && record.tier !== 'NORMAL' ? ` · ${record.tier} WIN` : ''}
                </span>
                <span className={`history-row__win${record.totalWin > 0 ? ' is-win' : ''}`}>
                  {record.totalWin > 0 ? `+${formatMoney(record.totalWin)}` : '—'}
                </span>
              </button>
              {openId === record.spinId && <SpinDetail record={record} />}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
