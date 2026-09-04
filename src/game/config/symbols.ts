import type { SymbolId } from '../types';

export type SymbolTier = 'CHARACTER' | 'PREMIUM' | 'LOW' | 'SPECIAL';

export interface SymbolMeta {
  id: SymbolId;
  /** short label used in compact UI (history grid, debug) */
  label: string;
  /** full name shown in the paytable */
  name: string;
  tier: SymbolTier;
  /** signature colour, used for win lines and highlights */
  color: number;
}

/** LUCKY BANDITS — the crew and the loot. */
export const SYMBOLS: Record<SymbolId, SymbolMeta> = {
  BOSS: { id: 'BOSS', label: 'BOSS', name: 'The Boss', tier: 'CHARACTER', color: 0xff4d4d },
  HACKER: { id: 'HACKER', label: 'HACK', name: 'The Hacker', tier: 'CHARACTER', color: 0x4fe3c1 },
  DRIVER: { id: 'DRIVER', label: 'DRIVE', name: 'The Driver', tier: 'CHARACTER', color: 0xffa229 },
  LADY: { id: 'LADY', label: 'LADY', name: 'The Lady', tier: 'CHARACTER', color: 0xc79bff },
  DIAMOND: { id: 'DIAMOND', label: 'GEM', name: 'Diamond Case', tier: 'PREMIUM', color: 0x7ce8ff },
  CASH: { id: 'CASH', label: 'CASH', name: 'Stack of Cash', tier: 'PREMIUM', color: 0x5dff9b },
  WATCH: { id: 'WATCH', label: 'WATCH', name: 'Gold Watch', tier: 'PREMIUM', color: 0xffd257 },
  CHIPS: { id: 'CHIPS', label: 'CHIPS', name: 'Chip Case', tier: 'PREMIUM', color: 0xff6b9d },
  A: { id: 'A', label: 'A', name: 'Ace', tier: 'LOW', color: 0xff6b52 },
  K: { id: 'K', label: 'K', name: 'King', tier: 'LOW', color: 0xffd257 },
  Q: { id: 'Q', label: 'Q', name: 'Queen', tier: 'LOW', color: 0xb06bff },
  J: { id: 'J', label: 'J', name: 'Jack', tier: 'LOW', color: 0x4fa8ff },
  TEN: { id: 'TEN', label: '10', name: 'Ten', tier: 'LOW', color: 0x5ddb7a },
  WILD: { id: 'WILD', label: 'WILD', name: 'Golden Vault (Wild)', tier: 'SPECIAL', color: 0xffd257 },
  SCATTER: { id: 'SCATTER', label: 'BONUS', name: 'Vault Key (Scatter)', tier: 'SPECIAL', color: 0x9fe8ff },
};

export const ALL_SYMBOLS = Object.keys(SYMBOLS) as SymbolId[];

/** Symbols that take part in ordinary left-to-right payline combinations. */
export const PAYING_SYMBOLS = ALL_SYMBOLS.filter((s) => s !== 'SCATTER' && s !== 'WILD');
