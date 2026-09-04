import { useEffect, useMemo, useState } from 'react';
import { Modal } from './Modal';
import type { GameRenderer } from '../render/GameRenderer';
import type { SymbolId } from '../game/types';
import { GAME_CONFIG, formatMoney } from '../game/config/game-config';
import { SYMBOLS } from '../game/config/symbols';
import { PAYLINE_COLORS } from '../render/RenderContext';

interface Props {
  renderer: GameRenderer | null;
  bet: number;
  onClose: () => void;
}

const ORDER: SymbolId[] = [
  'BOSS',
  'HACKER',
  'DRIVER',
  'LADY',
  'DIAMOND',
  'CASH',
  'WATCH',
  'CHIPS',
  'A',
  'K',
  'Q',
  'J',
  'TEN',
];

function PaylinePreview({ line, index }: { line: number[]; index: number }) {
  const color = `#${PAYLINE_COLORS[index % PAYLINE_COLORS.length].toString(16).padStart(6, '0')}`;
  const cw = 18;
  const ch = 14;
  const points = line.map((row, reel) => [reel * cw + cw / 2, row * ch + ch / 2]);
  return (
    <svg viewBox={`0 0 ${cw * 5} ${ch * 3}`} role="img" aria-label={`Payline ${index + 1}`}>
      {[0, 1, 2].map((row) =>
        [0, 1, 2, 3, 4].map((reel) => (
          <rect
            key={`${reel}-${row}`}
            x={reel * cw + 1.5}
            y={row * ch + 1.5}
            width={cw - 3}
            height={ch - 3}
            rx={3}
            fill={line[reel] === row ? color : 'rgba(255,255,255,0.06)'}
            opacity={line[reel] === row ? 0.55 : 1}
          />
        )),
      )}
      <polyline
        points={points.map((p) => p.join(',')).join(' ')}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Paytable({ renderer, bet, onClose }: Props) {
  const [images, setImages] = useState<Partial<Record<SymbolId, string>>>({});
  const lineBet = bet / GAME_CONFIG.lines;

  useEffect(() => {
    if (!renderer) return;
    const all: SymbolId[] = [...ORDER, 'WILD', 'SCATTER'];
    const entries: Partial<Record<SymbolId, string>> = {};
    // the paytable shows the very same files the reels use
    all.forEach((symbol) => {
      entries[symbol] = renderer.symbolImageUrl(symbol);
    });
    setImages(entries);
  }, [renderer]);

  const groups = useMemo(
    () => ({
      characters: ORDER.filter((s) => SYMBOLS[s].tier === 'CHARACTER'),
      premium: ORDER.filter((s) => SYMBOLS[s].tier === 'PREMIUM'),
      low: ORDER.filter((s) => SYMBOLS[s].tier === 'LOW'),
    }),
    [],
  );

  const renderCard = (symbol: SymbolId) => {
    const pays = GAME_CONFIG.paytable[symbol];
    if (!pays) return null;
    return (
      <div className="pay-card" key={symbol}>
        <div className="pay-card__art">
          {images[symbol] ? <img src={images[symbol]} alt={SYMBOLS[symbol].name} /> : null}
        </div>
        <div className="pay-card__info">
          <div className="pay-card__name">{SYMBOLS[symbol].name}</div>
          {[5, 4, 3].map((count) => (
            <div className="pay-row" key={count}>
              <span>{count} of a kind</span>
              <b>{formatMoney(pays[count - 3] * lineBet)}</b>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <Modal title="Paytable & game rules" onClose={onClose}>
      <div className="info-block">
        Wins are paid for <b>{GAME_CONFIG.lines} fixed paylines</b>, left to right, starting from reel 1.
        Only the highest win per line is paid. All values below are shown for your current total bet of{' '}
        <b>{formatMoney(bet)}</b>.
      </div>

      <h3 className="pt-section-title">The crew — top paying symbols</h3>
      <div className="pay-grid">{groups.characters.map(renderCard)}</div>

      <h3 className="pt-section-title">The loot — premium symbols</h3>
      <div className="pay-grid">{groups.premium.map(renderCard)}</div>

      <h3 className="pt-section-title">Standard symbols</h3>
      <div className="pay-grid">{groups.low.map(renderCard)}</div>

      <h3 className="pt-section-title">Wild</h3>
      <div className="pay-grid" style={{ maxWidth: 620, marginBottom: 10 }}>
        {(['wildX2', 'wildX3'] as const).map((key) => (
          <div className="pay-card" key={key}>
            <div className="pay-card__art">
              {renderer ? <img src={renderer.sceneImageUrl(key)} alt={key} /> : null}
            </div>
            <div className="pay-card__info">
              <div className="pay-card__name">{key === 'wildX2' ? 'Wild x2' : 'Wild x3'}</div>
              <div className="pay-row" style={{ display: 'block', lineHeight: 1.5 }}>
                Multiplies every win it completes by {key === 'wildX2' ? 'two' : 'three'}.
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="pay-card" style={{ maxWidth: 520 }}>
        <div className="pay-card__art">{images.WILD ? <img src={images.WILD} alt="Wild" /> : null}</div>
        <div className="pay-card__info">
          <div className="pay-card__name">{SYMBOLS.WILD.name}</div>
          <div className="pay-row" style={{ display: 'block', lineHeight: 1.6 }}>
            The golden vault lands on reels <b style={{ color: 'var(--gold)' }}>2, 3 and 4</b> and substitutes for
            every symbol except the Bonus Key. A vault can carry a multiplier that is applied to every win it
            completes.
          </div>
          <div className="chip-list">
            <span className="chip">x2 multiplier</span>
            <span className="chip">x3 multiplier</span>
            <span className="chip chip--gold">multipliers multiply each other</span>
          </div>
        </div>
      </div>

      <h3 className="pt-section-title">Scatter & free spins</h3>
      <div className="pay-card" style={{ maxWidth: 520 }}>
        <div className="pay-card__art">
          {images.SCATTER ? <img src={images.SCATTER} alt="Scatter" /> : null}
        </div>
        <div className="pay-card__info">
          <div className="pay-card__name">{SYMBOLS.SCATTER.name}</div>
          {[3, 4, 5].map((count) => (
            <div className="pay-row" key={count}>
              <span>
                {count} scatters → <b style={{ color: 'var(--gold)' }}>{GAME_CONFIG.scatter.freeSpins[count]} free spins</b>
              </span>
              <b>{formatMoney(GAME_CONFIG.scatterPays[count - 3] * bet)}</b>
            </div>
          ))}
        </div>
      </div>

      <div className="info-block" style={{ marginTop: 10 }}>
        <b>Locked vaults.</b> During free spins every golden vault that lands on reels 2, 3 or 4 is chained in
        place — with its multiplier — until the round ends. Several locked vaults on one payline multiply their
        values together, so x3 · x3 pays x9.
        <div className="chip-list">
          <span className="chip chip--cyan">3 scatters = 8 spins</span>
          <span className="chip chip--cyan">4 scatters = 12 spins</span>
          <span className="chip chip--cyan">5 scatters = 15 spins</span>
        </div>
      </div>

      <div className="info-block">
        <b>Big wins.</b> {GAME_CONFIG.bigWin.big}x your bet triggers BIG WIN, {GAME_CONFIG.bigWin.mega}x MEGA WIN
        and {GAME_CONFIG.bigWin.epic}x EPIC WIN. A single round is capped at {GAME_CONFIG.maxWinMultiplier}x the bet.
      </div>

      <h3 className="pt-section-title">{GAME_CONFIG.lines} paylines</h3>
      <div className="payline-grid">
        {GAME_CONFIG.paylines.map((line, index) => (
          <div className="payline-cell" key={index}>
            <PaylinePreview line={line} index={index} />
            <span>LINE {index + 1}</span>
          </div>
        ))}
      </div>

      <div className="info-block" style={{ marginTop: 16 }}>
        Theoretical return to player <b>95.9%</b>, verified over 20 million simulated spins
        (<code>npm run simulate</code>). Hit frequency <b>32.6%</b>, free spins on average once every{' '}
        <b>218 spins</b>. Malfunction voids all pays and plays.
      </div>
    </Modal>
  );
}
