import type {
  ForceMode,
  FreeSpinsState,
  SpinOutcome,
  SpinRecord,
  Transaction,
  WinTier,
} from '../types';
import { GAME_CONFIG, type GameConfig, money } from '../config/game-config';
import { MathEngine } from '../engine/MathEngine';
import { BonusEngine } from '../engine/BonusEngine';
import { gameRNG, type RandomSource } from '../engine/RNGEngine';
import { getWinTier } from '../engine/WinTier';
import { WalletService, createTransactionId, InsufficientFundsError } from '../wallet/WalletService';

/* ------------------------------------------------------------------ *
 *  Transport contracts — identical for the local and the remote driver.
 *  Remote endpoints:  POST /game/session · POST /game/spin
 *                     POST /game/bonus   · GET  /game/history
 *                     GET  /game/balance
 * ------------------------------------------------------------------ */

export interface SessionResponse {
  sessionId: string;
  /** signature placeholder — a real server signs the session and every spin */
  signature: string;
  balance: number;
  currency: string;
  bet: number;
  freeSpins: FreeSpinsState;
}

export interface SpinRequest {
  sessionId: string;
  bet: number;
  /** idempotency key: repeating a request must never charge twice */
  requestId: string;
  /** development only */
  force?: ForceMode;
}

export interface SpinResponse {
  spinId: string;
  sessionId: string;
  outcome: SpinOutcome;
  win: number;
  tier: WinTier;
  balance: number;
  freeSpins: FreeSpinsState;
  bonusTriggered: boolean;
  bonusCompleted: boolean;
  bonusTotalWin: number;
  record: SpinRecord;
}

export interface IGameAPI {
  createSession(bet: number): Promise<SessionResponse>;
  spin(request: SpinRequest): Promise<SpinResponse>;
  bonusSpin(request: SpinRequest): Promise<SpinResponse>;
  getBalance(sessionId: string): Promise<number>;
  getHistory(sessionId: string, limit?: number): Promise<SpinRecord[]>;
  getTransactions?(sessionId: string): Promise<Transaction[]>;
}

/* ------------------------------------------------------------------ *
 *  Local driver — full game server running in the browser tab.
 * ------------------------------------------------------------------ */

export interface LocalGameAPIOptions {
  config?: GameConfig;
  rng?: RandomSource;
  wallet?: WalletService;
}

export class LocalGameAPI implements IGameAPI {
  readonly config: GameConfig;
  readonly wallet: WalletService;
  private readonly rng: RandomSource;
  private readonly math: MathEngine;
  private readonly bonus: BonusEngine;

  private sessionId = '';
  private signature = '';
  private freeSpins: FreeSpinsState;
  private history: SpinRecord[] = [];
  /** idempotency cache: requestId -> response */
  private readonly responses = new Map<string, SpinResponse>();

  constructor(options: LocalGameAPIOptions = {}) {
    this.config = options.config ?? GAME_CONFIG;
    this.rng = options.rng ?? gameRNG;
    this.wallet = options.wallet ?? new WalletService(this.config.startingBalance);
    this.math = new MathEngine(this.config);
    this.bonus = new BonusEngine(this.config);
    this.freeSpins = this.bonus.idle();
  }

  async createSession(bet: number): Promise<SessionResponse> {
    this.sessionId = createTransactionId('sess');
    this.signature = createTransactionId('sig');
    this.freeSpins = this.bonus.idle();
    this.history = [];
    this.responses.clear();
    return {
      sessionId: this.sessionId,
      signature: this.signature,
      balance: this.wallet.getBalance(),
      currency: this.config.currency,
      bet,
      freeSpins: this.freeSpins,
    };
  }

  async spin(request: SpinRequest): Promise<SpinResponse> {
    this.assertSession(request.sessionId);
    const cached = this.responses.get(request.requestId);
    if (cached) return cached;

    if (this.freeSpins.active) throw new Error('Free spins in progress — use /game/bonus');
    if (!this.wallet.canAfford(request.bet)) {
      throw new InsufficientFundsError(request.bet, this.wallet.getBalance());
    }

    const balanceBefore = this.wallet.getBalance();
    const debit = this.wallet.debit(request.bet, `bet:${request.requestId}`);
    const transactionIds = [debit.id];

    try {
      const outcome = this.math.resolve({
        mode: 'BASE',
        bet: request.bet,
        rng: this.rng,
        force: request.force,
      });

      if (outcome.totalWin > 0) {
        transactionIds.push(this.wallet.credit(outcome.totalWin, `win:${request.requestId}`).id);
      }

      const bonusTriggered = outcome.scatter.freeSpinsAwarded > 0;
      if (bonusTriggered) {
        this.freeSpins = this.bonus.createState(outcome.scatter.freeSpinsAwarded, request.bet);
      }

      const response = this.buildResponse({
        outcome,
        request,
        balanceBefore,
        transactionIds,
        bonusTriggered,
        bonusCompleted: false,
      });
      this.responses.set(request.requestId, response);
      return response;
    } catch (error) {
      this.wallet.rollback(debit.id);
      throw error;
    }
  }

  async bonusSpin(request: SpinRequest): Promise<SpinResponse> {
    this.assertSession(request.sessionId);
    const cached = this.responses.get(request.requestId);
    if (cached) return cached;

    if (!this.freeSpins.active) throw new Error('No active free spin round');

    const balanceBefore = this.wallet.getBalance();
    const transactionIds: string[] = [];

    const outcome = this.math.resolve({
      mode: 'FREE',
      bet: this.freeSpins.triggerBet,
      rng: this.rng,
      stickyWilds: this.freeSpins.stickyWilds,
      force: request.force,
    });

    if (outcome.totalWin > 0) {
      transactionIds.push(this.wallet.credit(outcome.totalWin, `fswin:${request.requestId}`).id);
    }

    this.freeSpins = this.bonus.consumeSpin(this.freeSpins, outcome);
    const bonusCompleted = !this.freeSpins.active;

    const response = this.buildResponse({
      outcome,
      request: { ...request, bet: this.freeSpins.triggerBet },
      balanceBefore,
      transactionIds,
      bonusTriggered: false,
      bonusCompleted,
    });
    this.responses.set(request.requestId, response);
    return response;
  }

  async getBalance(sessionId: string): Promise<number> {
    this.assertSession(sessionId);
    return this.wallet.getBalance();
  }

  async getHistory(sessionId: string, limit = 50): Promise<SpinRecord[]> {
    this.assertSession(sessionId);
    return this.history.slice(0, limit);
  }

  async getTransactions(sessionId: string): Promise<Transaction[]> {
    this.assertSession(sessionId);
    return this.wallet.getTransactions();
  }

  /** demo-only helper (never exists on the remote driver) */
  topUp(amount: number): number {
    this.wallet.credit(amount, `topup:${createTransactionId()}`);
    return this.wallet.getBalance();
  }

  private assertSession(sessionId: string): void {
    if (!this.sessionId || sessionId !== this.sessionId) {
      throw new Error('Invalid or expired game session');
    }
  }

  private buildResponse(args: {
    outcome: SpinOutcome;
    request: SpinRequest;
    balanceBefore: number;
    transactionIds: string[];
    bonusTriggered: boolean;
    bonusCompleted: boolean;
  }): SpinResponse {
    const { outcome, request, balanceBefore, transactionIds, bonusTriggered, bonusCompleted } = args;
    const tier = getWinTier(outcome.totalWin, request.bet, this.config);
    const record: SpinRecord = {
      spinId: createTransactionId('spin'),
      sessionId: this.sessionId,
      timestamp: Date.now(),
      mode: outcome.mode,
      bet: request.bet,
      totalWin: outcome.totalWin,
      balanceBefore,
      balanceAfter: this.wallet.getBalance(),
      freeSpin: outcome.mode === 'FREE',
      freeSpinIndex: outcome.mode === 'FREE' ? this.freeSpins.spinsUsed : undefined,
      multipliers: outcome.wilds.map((w) => w.multiplier).filter((m) => m > 1),
      scatterCount: outcome.scatter.count,
      tier,
      outcome,
      transactionIds,
    };

    this.history.unshift(record);
    if (this.history.length > 200) this.history.pop();

    return {
      spinId: record.spinId,
      sessionId: this.sessionId,
      outcome,
      win: outcome.totalWin,
      tier,
      balance: this.wallet.getBalance(),
      freeSpins: this.freeSpins,
      bonusTriggered,
      bonusCompleted,
      bonusTotalWin: money(this.freeSpins.totalWin),
      record,
    };
  }
}

/* ------------------------------------------------------------------ *
 *  Remote driver — drop-in replacement for production.
 *  The client then only *renders* what the server decided.
 * ------------------------------------------------------------------ */

export class RemoteGameAPI implements IGameAPI {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
  ) {}

  private async post<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`${path} failed: ${response.status}`);
    return (await response.json()) as T;
  }

  private async get<T>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      headers: { Authorization: `Bearer ${this.token}` },
    });
    if (!response.ok) throw new Error(`${path} failed: ${response.status}`);
    return (await response.json()) as T;
  }

  createSession(bet: number): Promise<SessionResponse> {
    return this.post<SessionResponse>('/game/session', { gameId: GAME_CONFIG.id, bet });
  }

  spin(request: SpinRequest): Promise<SpinResponse> {
    return this.post<SpinResponse>('/game/spin', request);
  }

  bonusSpin(request: SpinRequest): Promise<SpinResponse> {
    return this.post<SpinResponse>('/game/bonus', request);
  }

  getBalance(sessionId: string): Promise<number> {
    return this.get<{ balance: number }>(`/game/balance?sessionId=${sessionId}`).then((r) => r.balance);
  }

  getHistory(sessionId: string, limit = 50): Promise<SpinRecord[]> {
    return this.get<{ items: SpinRecord[] }>(
      `/game/history?sessionId=${sessionId}&limit=${limit}`,
    ).then((r) => r.items);
  }
}
