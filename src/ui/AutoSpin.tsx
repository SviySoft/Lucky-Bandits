import { useState } from 'react';
import { Modal } from './Modal';
import type { GameEngine } from '../game/GameEngine';

interface Props {
  engine: GameEngine;
  onClose: () => void;
}

export function AutoSpin({ engine, onClose }: Props) {
  const [count, setCount] = useState<number>(engine.config.autoSpinOptions[0]);
  const [stopOnFreeSpins, setStopOnFreeSpins] = useState(false);
  const [stopOnBigWin, setStopOnBigWin] = useState(false);

  return (
    <Modal title="Auto spin" onClose={onClose} narrow>
      <div className="auto-grid">
        {engine.config.autoSpinOptions.map((option) => (
          <button
            key={option}
            className={`bet-option${option === count ? ' is-active' : ''}`}
            onClick={() => setCount(option)}
          >
            {option < 0 ? '∞' : option}
            <small>{option < 0 ? 'INFINITE' : 'SPINS'}</small>
          </button>
        ))}
      </div>

      <div className="toggle-row">
        <span>Stop on free spins</span>
        <button
          className={`switch${stopOnFreeSpins ? ' is-on' : ''}`}
          onClick={() => setStopOnFreeSpins((v) => !v)}
          aria-label="Stop on free spins"
        />
      </div>
      <div className="toggle-row">
        <span>Stop on big win</span>
        <button
          className={`switch${stopOnBigWin ? ' is-on' : ''}`}
          onClick={() => setStopOnBigWin((v) => !v)}
          aria-label="Stop on big win"
        />
      </div>

      <div className="info-block" style={{ margin: '14px 0' }}>
        Auto spin stops automatically when the balance is too low for the next bet, on any error, or the
        moment you press <b>STOP</b>.
      </div>

      <button
        className="primary-btn"
        onClick={() => {
          engine.startAutoplay(count, { stopOnFreeSpins, stopOnBigWin });
          onClose();
        }}
      >
        START {count < 0 ? 'INFINITE' : count} SPINS
      </button>
    </Modal>
  );
}
