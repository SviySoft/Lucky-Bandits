import type {
  ForceMode,
  FreeSpinsState,
  GameStateName,
  SpinRecord,
  Transaction,
  WinTier,
} from './types';
import { GAME_CONFIG, type GameConfig, money } from './config/game-config';
import { StateMachine } from './GameState';
import { LocalGameAPI, type IGameAPI, type SpinResponse } from './api/GameAPI';
import { createTransactionId, InsufficientFundsError } from './wallet/WalletService';
import type { GamePresenter } from '../render/GamePresenter';
import { NullPresenter } from '../render/GamePresenter';
import type { AudioManager } from '../audio/AudioManager';

export interface AutoplayState {
  active: boolean;
  remaining: number;
  infinite: boolean;
  stopOnFreeSpins: boolean;
  stopOnBigWin: boolean;
}

export interface GameSnapshot {
  state: GameStateName;
  balance: number;
  bet: number;
  betIndex: number;
  win: number;
  lastWin: number;
  roundWin: number;
  tier: WinTier;
  freeSpins: FreeSpinsState;
  autoplay: AutoplayState;
  turbo: boolean;
  busy: boolean;
  canSpin: boolean;
  sessionId: string;
  error: string | null;
  lastRecord: SpinRecord | null;
  spinCount: number;
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Game Engine — orchestrates api ⇄ state machine ⇄ presenter ⇄ audio.
 * It never computes a win itself: that is the Math Engine's (later: the server's) job.
 */
export class GameEngine {
  readonly config: GameConfig;
  readonly api: IGameAPI;
  private readonly machine = new StateMachine();
  private presenter: GamePresenter = new NullPresenter();
  private audio: AudioManager | null = null;

  private sessionId = '';
  private betIndex: number;
  private balance = 0;
  private win = 0;
  private lastWin = 0;
  private roundWin = 0;
  private tier: WinTier = 'NONE';
  private freeSpins: FreeSpinsState = {
    active: false,
    spinsTotal: 0,
    spinsUsed: 0,
    totalWin: 0,
    stickyWilds: [],
    triggerBet: 0,
  };
  private autoplay: AutoplayState = {
    active: false,
    remaining: 0,
    infinite: false,
    stopOnFreeSpins: false,
    stopOnBigWin: false,
  };
  private turbo = false;
  private error: string | null = null;
  private lastRecord: SpinRecord | null = null;
  private spinCount = 0;
  private forceMode: ForceMode = 'NONE';
  private autoplayTimer: ReturnType<typeof setTimeout> | null = null;
  private errorTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly listeners = new Set<(snapshot: GameSnapshot) => void>();

  constructor(options: { config?: GameConfig; api?: IGameAPI } = {}) {
    this.config = options.config ?? GAME_CONFIG;
    this.api = options.api ?? new LocalGameAPI({ config: this.config });
    this.betIndex = this.config.defaultBetIndex;
    this.machine.onChange(() => this.emit());
  }

  /* ---------------- lifecycle ---------------- */

  attachPresenter(presenter: GamePresenter): void {
    this.presenter = presenter;
    this.presenter.setTurbo(this.turbo);
  }

  attachAudio(audio: AudioManager): void {
    this.audio = audio;
  }

  async start(): Promise<void> {
    const session = await this.api.createSession(this.bet);
    this.sessionId = session.sessionId;
    this.balance = session.balance;
    this.machine.set('READY');
    this.emit();
  }

  /* ---------------- observable state ---------------- */

  subscribe(listener: (snapshot: GameSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => this.listeners.delete(listener);
  }

  snapshot(): GameSnapshot {
    return {
      state: this.machine.current,
      balance: this.balance,
      bet: this.bet,
      betIndex: this.betIndex,
      win: this.win,
      lastWin: this.lastWin,
      roundWin: this.roundWin,
      tier: this.tier,
      freeSpins: this.freeSpins,
      autoplay: this.autoplay,
      turbo: this.turbo,
      busy: this.machine.isBusy(),
      canSpin: this.canSpin(),
      sessionId: this.sessionId,
      error: this.error,
      lastRecord: this.lastRecord,
      spinCount: this.spinCount,
    };
  }

  private emit(): void {
    const snap = this.snapshot();
    this.listeners.forEach((l) => l(snap));
  }

  /* ---------------- player controls ---------------- */

  get bet(): number {
    return this.config.betLevels[this.betIndex];
  }

  setBetIndex(index: number): void {
    if (this.machine.isBusy()) return;
    this.betIndex = Math.max(0, Math.min(this.config.betLevels.length - 1, index));
    this.emit();
  }

  stepBet(direction: 1 | -1): void {
    this.setBetIndex(this.betIndex + direction);
  }

  setTurbo(turbo: boolean): void {
    this.turbo = turbo;
    this.presenter.setTurbo(turbo);
    this.emit();
  }

  setForceMode(mode: ForceMode): void {
    this.forceMode = mode;
    this.emit();
  }

  getForceMode(): ForceMode {
    return this.forceMode;
  }

  canSpin(): boolean {
    return (
      this.machine.current === 'READY' &&
      !this.freeSpins.active &&
      this.balance + 1e-9 >= this.bet
    );
  }

  /** SPIN button: starts a spin, or fast-forwards the current animation. */
  requestSpin(): void {
    if (this.machine.current === 'ERROR') this.clearError();
    if (this.machine.isBusy()) {
      this.presenter.skip();
      return;
    }
    void this.spin();
  }

  startAutoplay(count: number, options: { stopOnFreeSpins?: boolean; stopOnBigWin?: boolean } = {}): void {
    this.autoplay = {
      active: true,
      infinite: count < 0,
      remaining: count < 0 ? Infinity : count,
      stopOnFreeSpins: options.stopOnFreeSpins ?? false,
      stopOnBigWin: options.stopOnBigWin ?? false,
    };
    this.emit();
    if (!this.machine.isBusy()) void this.spin();
  }

  stopAutoplay(): void {
    this.autoplay = { ...this.autoplay, active: false, remaining: 0 };
    if (this.autoplayTimer) {
      clearTimeout(this.autoplayTimer);
      this.autoplayTimer = null;
    }
    this.emit();
  }

  async getHistory(limit = 50): Promise<SpinRecord[]> {
    if (!this.sessionId) return [];
    return this.api.getHistory(this.sessionId, limit);
  }

  async getTransactions(): Promise<Transaction[]> {
    if (!this.sessionId || !this.api.getTransactions) return [];
    return this.api.getTransactions(this.sessionId);
  }

  clearError(): void {
    if (this.errorTimer) {
      clearTimeout(this.errorTimer);
      this.errorTimer = null;
    }
    this.error = null;
    if (this.machine.current === 'ERROR') this.machine.force('READY');
    this.emit();
  }

  /* ---------------- the round ---------------- */

  private async spin(): Promise<void> {
    if (!this.canSpin()) {
      if (this.balance < this.bet) this.failRound('Insufficient balance for this bet');
      return;
    }

    this.win = 0;
    this.roundWin = 0;
    this.tier = 'NONE';
    this.error = null;
    this.presenter.clearWins();
    this.machine.set('SPINNING');
    this.spinCount += 1;
    this.emit();

    try {
      this.audio?.play('spin');
      const response = await this.api.spin({
        sessionId: this.sessionId,
        bet: this.bet,
        requestId: createTransactionId('req'),
        force: this.forceMode === 'NONE' ? undefined : this.forceMode,
      });
      this.forceMode = 'NONE';

      // show the bet leaving the wallet straight away, exactly like a real cashier
      this.balance = money(response.record.balanceBefore - response.record.bet);
      this.emit();

      await this.playSpinResponse(response);

      if (response.bonusTriggered) {
        await this.runFreeSpins(response);
      }

      this.finishRound();
    } catch (error) {
      this.failRound(error instanceof Error ? error.message : String(error));
    }
  }

  /** shared presentation path for base and free spins */
  private async playSpinResponse(response: SpinResponse): Promise<void> {
    await this.presenter.spin(response.outcome);
    this.machine.set('EVALUATING');

    this.balance = response.balance;
    this.lastRecord = response.record;
    this.freeSpins = response.freeSpins;
    this.roundWin = money(this.roundWin + response.win);
    this.emit();

    if (response.outcome.scatter.count >= 3) this.audio?.play('scatter');

    if (response.win > 0) {
      this.win = response.win;
      this.lastWin = response.win;
      this.tier = response.tier;
      this.machine.set('WIN');
      this.emit();
      this.audio?.play(response.tier === 'NORMAL' ? 'win' : 'bigwin');
      await this.presenter.presentWins(response.outcome, response.record.bet);

      if (response.tier !== 'NORMAL' && response.tier !== 'NONE') {
        this.machine.set('BIG_WIN');
        this.emit();
        await this.presenter.presentBigWin(response.tier, response.win, response.record.bet);
      }
    }
  }

  private async runFreeSpins(trigger: SpinResponse): Promise<void> {
    this.machine.set('BONUS_TRIGGER');
    this.emit();
    this.audio?.play('bonus');
    await this.presenter.presentBonusTrigger(
      trigger.outcome.scatter.count,
      trigger.freeSpins.spinsTotal,
    );

    this.machine.set('FREE_SPINS');
    this.emit();
    await this.presenter.setMode('FREE');

    let guard = 0;
    while (this.freeSpins.active && guard < 500) {
      guard += 1;
      this.presenter.setStickyWilds(this.freeSpins.stickyWilds);
      this.presenter.clearWins();
      this.win = 0;
      this.emit();
      await wait(this.turbo ? 120 : 320);

      this.machine.set('SPINNING');
      this.emit();
      this.audio?.play('spin');
      const response = await this.api.bonusSpin({
        sessionId: this.sessionId,
        bet: this.freeSpins.triggerBet,
        requestId: createTransactionId('req'),
      });

      await this.playSpinResponse(response);
      if (response.outcome.wilds.some((w) => !w.sticky)) this.audio?.play('wild');
    }

    const summary = this.freeSpins.totalWin;
    await this.presenter.presentBonusSummary(summary, this.freeSpins.spinsTotal);
    this.presenter.setStickyWilds([]);
    await this.presenter.setMode('BASE');
    this.win = summary;
    this.emit();
  }

  private finishRound(): void {
    this.machine.set('READY');
    this.emit();
    this.scheduleAutoplay();
  }

  private failRound(message: string): void {
    this.error = message;
    this.machine.force('ERROR');
    this.stopAutoplay();
    this.emit();
    if (this.errorTimer) clearTimeout(this.errorTimer);
    this.errorTimer = setTimeout(() => {
      this.errorTimer = null;
      this.clearError();
    }, 3500);
    if (!(message.includes('Insufficient'))) {
      // eslint-disable-next-line no-console
      console.error('[GameEngine]', message);
    }
  }

  private scheduleAutoplay(): void {
    if (!this.autoplay.active) return;

    const stopForBonus = this.autoplay.stopOnFreeSpins && this.freeSpins.spinsTotal > 0;
    const stopForBigWin =
      this.autoplay.stopOnBigWin && this.tier !== 'NONE' && this.tier !== 'NORMAL';

    if (stopForBonus || stopForBigWin) {
      this.stopAutoplay();
      return;
    }

    const remaining = this.autoplay.infinite ? Infinity : this.autoplay.remaining - 1;
    if (remaining <= 0) {
      this.stopAutoplay();
      return;
    }
    if (this.balance < this.bet) {
      this.stopAutoplay();
      this.error = 'Autoplay stopped — insufficient balance';
      this.emit();
      return;
    }

    this.autoplay = { ...this.autoplay, remaining };
    this.emit();
    this.autoplayTimer = setTimeout(() => {
      this.autoplayTimer = null;
      if (this.autoplay.active && this.canSpin()) void this.spin();
    }, this.turbo ? 120 : 420);
  }

  /** demo helper for the debug panel */
  topUp(amount: number): void {
    const api = this.api as LocalGameAPI;
    if (typeof api.topUp === 'function') {
      this.balance = api.topUp(amount);
      if (this.machine.current === 'ERROR') this.clearError();
      this.emit();
    }
  }
}

export { InsufficientFundsError };
