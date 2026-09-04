import { useState } from 'react';
import { Modal } from './Modal';
import type { GameEngine, GameSnapshot } from '../game/GameEngine';
import { audioManager } from '../audio/AudioManager';
import { GAME_CONFIG, formatMoney } from '../game/config/game-config';

interface Props {
  engine: GameEngine;
  snapshot: GameSnapshot;
  onClose: () => void;
}

export function Settings({ engine, snapshot, onClose }: Props) {
  const [settings, setSettings] = useState(audioManager.getSettings());

  const update = (patch: Partial<typeof settings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    if (patch.musicEnabled !== undefined) audioManager.setMusicEnabled(patch.musicEnabled);
    if (patch.sfxEnabled !== undefined) audioManager.setSfxEnabled(patch.sfxEnabled);
    if (patch.musicVolume !== undefined) audioManager.setMusicVolume(patch.musicVolume);
    if (patch.sfxVolume !== undefined) audioManager.setSfxVolume(patch.sfxVolume);
  };

  return (
    <Modal title="Settings" onClose={onClose} narrow>
      <div className="toggle-row">
        <span>Background music</span>
        <button
          className={`switch${settings.musicEnabled ? ' is-on' : ''}`}
          onClick={() => update({ musicEnabled: !settings.musicEnabled })}
          aria-label="Music"
        />
      </div>
      <div className="toggle-row">
        <span>Music volume</span>
        <input
          className="slider"
          type="range"
          min={0}
          max={100}
          value={Math.round(settings.musicVolume * 100)}
          onChange={(e) => update({ musicVolume: Number(e.target.value) / 100 })}
        />
      </div>
      <div className="toggle-row">
        <span>Sound effects</span>
        <button
          className={`switch${settings.sfxEnabled ? ' is-on' : ''}`}
          onClick={() => update({ sfxEnabled: !settings.sfxEnabled })}
          aria-label="Sound effects"
        />
      </div>
      <div className="toggle-row">
        <span>Effects volume</span>
        <input
          className="slider"
          type="range"
          min={0}
          max={100}
          value={Math.round(settings.sfxVolume * 100)}
          onChange={(e) => update({ sfxVolume: Number(e.target.value) / 100 })}
        />
      </div>
      <div className="toggle-row">
        <span>Turbo spin</span>
        <button
          className={`switch${snapshot.turbo ? ' is-on' : ''}`}
          onClick={() => engine.setTurbo(!snapshot.turbo)}
          aria-label="Turbo"
        />
      </div>

      <h3 className="pt-section-title">Game information</h3>
      <div className="info-block">
        <div className="kv">
          <div>
            <span>Game</span>
            <b>{GAME_CONFIG.name}</b>
          </div>
          <div>
            <span>Version</span>
            <b>{GAME_CONFIG.version}</b>
          </div>
          <div>
            <span>Reels</span>
            <b>
              {GAME_CONFIG.reels} x {GAME_CONFIG.rows}
            </b>
          </div>
          <div>
            <span>Paylines</span>
            <b>{GAME_CONFIG.lines} fixed</b>
          </div>
          <div>
            <span>Theoretical RTP</span>
            <b>95.9%</b>
          </div>
          <div>
            <span>Volatility</span>
            <b>High</b>
          </div>
          <div>
            <span>Max win</span>
            <b>{GAME_CONFIG.maxWinMultiplier}x bet</b>
          </div>
          <div>
            <span>Session</span>
            <b style={{ fontSize: 11 }}>{snapshot.sessionId.slice(0, 18)}</b>
          </div>
        </div>
      </div>

      <div className="info-block">
        Demo credits only — no real money is involved. Current balance{' '}
        <b>{formatMoney(snapshot.balance)}</b>.
      </div>

      <button
        className="primary-btn"
        style={{ marginTop: 14 }}
        onClick={() => {
          engine.topUp(1000);
          onClose();
        }}
      >
        ADD 1 000 DEMO CREDITS
      </button>
    </Modal>
  );
}
