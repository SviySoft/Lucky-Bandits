import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { GameEngine, GameSnapshot } from '../game/GameEngine';
import { formatMoney, GAME_CONFIG } from '../game/config/game-config';
import { SCENE_LAYOUT, type SceneRect } from '../render/sceneLayout';
import { IconSpin, IconStop } from './icons';

interface GameHUDProps {
  engine: GameEngine;
  snapshot: GameSnapshot;
  onOpen: (panel: 'paytable' | 'history' | 'settings' | 'autoplay' | 'bet') => void;
  onToggleSound: () => void;
  soundOn: boolean;
}

/**
 * The interface is anchored to the reference plate: every control sits exactly on the
 * painted one, in the plate's own coordinate space, scaled by --ps.
 */
function anchor(rect: SceneRect, extra: CSSProperties = {}): CSSProperties {
  return {
    position: 'absolute',
    left: `calc(var(--px) + ${rect.x}px * var(--ps))`,
    top: `calc(var(--py) + ${rect.y}px * var(--ps))`,
    width: `calc(${rect.w}px * var(--ps))`,
    height: `calc(${rect.h}px * var(--ps))`,
    ...extra,
  };
}

const scaled = (px: number) => `calc(${px}px * var(--ps))`;

/** smooth count-up for the WIN meter (§20) */
function useAnimatedNumber(value: number, duration = 700): number {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const from = fromRef.current;
    if (from === value) return;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setDisplay(from + (value - from) * (1 - Math.pow(1 - t, 3)));
      if (t < 1) rafRef.current = requestAnimationFrame(step);
      else fromRef.current = value;
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration]);

  useEffect(() => {
    if (value === 0) {
      fromRef.current = 0;
      setDisplay(0);
    }
  }, [value]);

  return display;
}

function useClock(): string {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 20000);
    return () => clearInterval(id);
  }, []);
  return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const JACKPOT_COLOUR: Record<string, string> = {
  mega: '#ffb3e6',
  major: '#ffffff',
  minor: '#ffffff',
  mini: '#ffd257',
};

export function GameHUD({ engine, snapshot, onOpen, onToggleSound, soundOn }: GameHUDProps) {
  const win = useAnimatedNumber(snapshot.win, snapshot.turbo ? 320 : 900);
  const clock = useClock();
  const { freeSpins, autoplay } = snapshot;
  const V = SCENE_LAYOUT.values;
  const H = SCENE_LAYOUT.hits;

  const spinning = snapshot.state === 'SPINNING';
  const inBonus = freeSpins.active || snapshot.state === 'FREE_SPINS' || snapshot.state === 'BONUS_TRIGGER';
  const fsTotal = freeSpins.spinsTotal || 12;
  const fsUsed = inBonus ? Math.min(freeSpins.spinsUsed + (freeSpins.active ? 1 : 0), fsTotal) : 0;

  const message = spinning
    ? 'GOOD LUCK!'
    : snapshot.state === 'BONUS_TRIGGER'
      ? 'BONUS! FREE SPINS AWARDED'
      : freeSpins.active
        ? `FREE SPIN ${Math.min(freeSpins.spinsUsed + 1, fsTotal)} OF ${fsTotal}`
        : snapshot.win > 0
          ? `YOU WIN ${formatMoney(snapshot.win)}!`
          : 'PRESS SPIN TO WIN!';

  const jackpotRects: Record<string, SceneRect> = {
    mega: V['jp-mega'],
    major: V['jp-major'],
    minor: V['jp-minor'],
    mini: V['jp-mini'],
  };

  return (
    <div className="scene-ui">
      {/* ---- live values, drawn where the reference painted them ---- */}
      <div className="ui-value ui-value--left" style={anchor(V.balance, { fontSize: scaled(33), paddingLeft: scaled(6) })}>
        {formatMoney(snapshot.balance)}
      </div>

      {GAME_CONFIG.jackpots.map((tier) => (
        <div
          key={tier.id}
          className="ui-value"
          style={anchor(jackpotRects[tier.id], {
            fontSize: scaled(23),
            color: JACKPOT_COLOUR[tier.id] ?? '#ffffff',
          })}
        >
          {formatMoney(tier.value)}
        </div>
      ))}

      <div className={`ui-freespins${inBonus ? ' is-live' : ''}`} style={anchor(V.freespins)}>
        <b style={{ fontSize: scaled(54) }}>{fsUsed}</b>
        <span style={{ fontSize: scaled(30) }}>/ {fsTotal}</span>
      </div>

      <div className="ui-message" style={anchor(V.message, { fontSize: scaled(29) })}>
        {message}
      </div>

      <div className="ui-value" style={anchor(V.bet, { fontSize: scaled(29) })}>
        {formatMoney(snapshot.bet)}
      </div>

      <div className={`ui-value${snapshot.win > 0 ? ' is-hot' : ''}`} style={anchor(V.win, { fontSize: scaled(36) })}>
        {formatMoney(inBonus ? Math.max(win, freeSpins.totalWin) : win)}
      </div>

      <div className="ui-value ui-value--dim" style={anchor(V.clock, { fontSize: scaled(20) })}>
        {clock}
      </div>

      {/* ---- interaction laid over the painted controls ---- */}
      <button className="hit" style={anchor(H.menu)} onClick={() => onOpen('settings')} aria-label="Menu" />
      <button className="hit" style={anchor(H.paytable)} onClick={() => onOpen('paytable')} aria-label="Paytable" />
      <button
        className="hit hit--round"
        style={anchor(H.betMinus)}
        onClick={() => engine.stepBet(-1)}
        disabled={snapshot.busy || inBonus}
        aria-label="Decrease bet"
      />
      <button
        className="hit hit--round"
        style={anchor(H.betPlus)}
        onClick={() => engine.stepBet(1)}
        disabled={snapshot.busy || inBonus}
        aria-label="Increase bet"
      />
      <button
        className="hit"
        style={anchor(H.betValue)}
        onClick={() => onOpen('bet')}
        disabled={snapshot.busy || inBonus}
        aria-label="Bet level"
      />
      <button
        className={`hit${autoplay.active ? ' is-on' : ''}`}
        style={anchor(H.autoplay)}
        onClick={() => (autoplay.active ? engine.stopAutoplay() : onOpen('autoplay'))}
        disabled={inBonus}
        aria-label="Auto play"
      />
      <button
        className={`hit${snapshot.turbo ? ' is-on' : ''}`}
        style={anchor(H.turbo)}
        onClick={() => engine.setTurbo(!snapshot.turbo)}
        aria-label="Turbo"
      />
      <button
        className={`hit hit--circle${soundOn ? '' : ' is-muted'}`}
        style={anchor(H.sound)}
        onClick={onToggleSound}
        aria-label="Sound"
      />
      <button
        className="hit hit--circle"
        style={anchor(H.fullscreen)}
        onClick={() => {
          if (document.fullscreenElement) void document.exitFullscreen();
          else void document.documentElement.requestFullscreen?.();
        }}
        aria-label="Fullscreen"
      />
      <button className="hit hit--circle" style={anchor(H.info)} onClick={() => onOpen('paytable')} aria-label="Info" />
      <button
        className="hit hit--circle"
        style={anchor(H.burger)}
        onClick={() => onOpen('history')}
        aria-label="Game history"
      />

      {/* SPIN: the painted button plus its live state */}
      <button
        className={`hit hit--spin${spinning ? ' is-spinning' : ''}`}
        style={anchor(H.spin)}
        onClick={() => engine.requestSpin()}
        disabled={inBonus}
        aria-label="Spin"
      >
        {spinning && (
          <span className="spin-state">
            <IconStop className="" />
            <b style={{ fontSize: scaled(20) }}>STOP</b>
          </span>
        )}
        {!spinning && snapshot.busy && <span className="spin-wait" />}
        {autoplay.active && (
          <span className="autoplay-badge" style={{ fontSize: scaled(18) }}>
            {autoplay.infinite ? '∞' : autoplay.remaining}
          </span>
        )}
        <span className="sr-only">
          <IconSpin className="" />
        </span>
      </button>

      {snapshot.error && (
        <div className="error-toast" style={{ bottom: `calc(var(--py) + ${1024 - 800}px * var(--ps))` }}>
          {snapshot.error}
        </div>
      )}
    </div>
  );
}
