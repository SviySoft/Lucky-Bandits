import type { GameStateName } from './types';

/**
 * Explicit state machine. Illegal transitions throw instead of silently producing
 * overlapping animations (e.g. a second spin while a big win is playing).
 */
const TRANSITIONS: Record<GameStateName, GameStateName[]> = {
  LOADING: ['READY', 'ERROR'],
  READY: ['SPINNING', 'ERROR', 'LOADING'],
  SPINNING: ['EVALUATING', 'ERROR'],
  EVALUATING: ['WIN', 'READY', 'BONUS_TRIGGER', 'BIG_WIN', 'FREE_SPINS', 'SPINNING', 'ERROR'],
  WIN: ['READY', 'BIG_WIN', 'BONUS_TRIGGER', 'FREE_SPINS', 'SPINNING', 'ERROR'],
  BONUS_TRIGGER: ['FREE_SPINS', 'ERROR'],
  FREE_SPINS: ['SPINNING', 'EVALUATING', 'WIN', 'BIG_WIN', 'READY', 'FREE_SPINS', 'ERROR'],
  BIG_WIN: ['READY', 'FREE_SPINS', 'BONUS_TRIGGER', 'SPINNING', 'ERROR'],
  ERROR: ['READY', 'LOADING'],
};

export class StateMachine {
  private state: GameStateName = 'LOADING';
  private readonly listeners = new Set<(next: GameStateName, prev: GameStateName) => void>();

  get current(): GameStateName {
    return this.state;
  }

  can(next: GameStateName): boolean {
    return next === this.state || TRANSITIONS[this.state].includes(next);
  }

  set(next: GameStateName): void {
    if (next === this.state) return;
    if (!this.can(next)) {
      throw new Error(`Illegal game state transition: ${this.state} -> ${next}`);
    }
    const prev = this.state;
    this.state = next;
    this.listeners.forEach((l) => l(next, prev));
  }

  /** used by the error path — always allowed */
  force(next: GameStateName): void {
    const prev = this.state;
    this.state = next;
    this.listeners.forEach((l) => l(next, prev));
  }

  onChange(listener: (next: GameStateName, prev: GameStateName) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  isBusy(): boolean {
    return this.state !== 'READY' && this.state !== 'ERROR';
  }
}
