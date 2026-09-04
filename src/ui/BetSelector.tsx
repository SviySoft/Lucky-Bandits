import { Modal } from './Modal';
import type { GameEngine, GameSnapshot } from '../game/GameEngine';
import { formatMoney } from '../game/config/game-config';

interface Props {
  engine: GameEngine;
  snapshot: GameSnapshot;
  onClose: () => void;
}

export function BetSelector({ engine, snapshot, onClose }: Props) {
  const levels = engine.config.betLevels;
  return (
    <Modal title="Select your bet" onClose={onClose} narrow>
      <div className="bet-grid">
        {levels.map((level, index) => (
          <button
            key={level}
            className={`bet-option${index === snapshot.betIndex ? ' is-active' : ''}`}
            disabled={level > snapshot.balance && index !== snapshot.betIndex}
            onClick={() => {
              engine.setBetIndex(index);
              onClose();
            }}
          >
            {formatMoney(level)}
            <small>{(level / engine.config.lines).toFixed(3)} / line</small>
          </button>
        ))}
      </div>
      <div className="info-block" style={{ marginTop: 16 }}>
        Every bet is split across all <b>{engine.config.lines} fixed paylines</b>. Payouts in the paytable
        are quoted per line bet, so a higher total bet scales every win proportionally.
      </div>
    </Modal>
  );
}
