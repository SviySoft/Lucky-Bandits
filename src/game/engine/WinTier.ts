import type { WinTier } from '../types';
import type { GameConfig } from '../config/game-config';

export function getWinTier(win: number, bet: number, config: GameConfig): WinTier {
  if (win <= 0) return 'NONE';
  const x = win / bet;
  if (x >= config.bigWin.epic) return 'EPIC';
  if (x >= config.bigWin.mega) return 'MEGA';
  if (x >= config.bigWin.big) return 'BIG';
  return 'NORMAL';
}

export const TIER_LABEL: Record<WinTier, string> = {
  NONE: '',
  NORMAL: 'WIN',
  BIG: 'BIG WIN',
  MEGA: 'MEGA WIN',
  EPIC: 'EPIC WIN',
};
