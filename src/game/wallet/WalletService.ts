import type { Transaction } from '../types';
import { money } from '../config/game-config';

export class InsufficientFundsError extends Error {
  constructor(public readonly required: number, public readonly available: number) {
    super(`Insufficient funds: required ${required}, available ${available}`);
    this.name = 'InsufficientFundsError';
  }
}

let counter = 0;
export function createTransactionId(prefix = 'tx'): string {
  counter += 1;
  const rand =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID().split('-')[0]
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}_${rand}`;
}

/**
 * Wallet Service.
 *
 * The single owner of the balance. UI components never mutate money — they read it
 * from here through the engine. Every movement produces an immutable transaction
 * with a unique id, which is exactly the contract a real cashier/PSP expects.
 */
export class WalletService {
  private balance: number;
  private readonly transactions: Transaction[] = [];
  /** idempotency guard: reference -> transaction */
  private readonly byReference = new Map<string, Transaction>();

  constructor(startingBalance: number) {
    this.balance = money(startingBalance);
  }

  getBalance(): number {
    return this.balance;
  }

  canAfford(amount: number): boolean {
    return this.balance + 1e-9 >= amount;
  }

  debit(amount: number, reference: string): Transaction {
    const cached = this.byReference.get(reference);
    if (cached) return cached; // replay / duplicate protection

    const value = money(amount);
    if (value <= 0) throw new Error('Debit amount must be positive');
    if (!this.canAfford(value)) throw new InsufficientFundsError(value, this.balance);

    const tx: Transaction = {
      id: createTransactionId('dbt'),
      type: 'DEBIT',
      amount: value,
      balanceBefore: this.balance,
      balanceAfter: money(this.balance - value),
      timestamp: Date.now(),
      reference,
    };
    this.balance = tx.balanceAfter;
    this.commit(tx, reference);
    return tx;
  }

  credit(amount: number, reference: string): Transaction {
    const cached = this.byReference.get(reference);
    if (cached) return cached;

    const value = money(amount);
    if (value < 0) throw new Error('Credit amount must not be negative');

    const tx: Transaction = {
      id: createTransactionId('crd'),
      type: 'CREDIT',
      amount: value,
      balanceBefore: this.balance,
      balanceAfter: money(this.balance + value),
      timestamp: Date.now(),
      reference,
    };
    this.balance = tx.balanceAfter;
    this.commit(tx, reference);
    return tx;
  }

  /** Compensating transaction — used when a spin fails after the bet was taken. */
  rollback(transactionId: string): Transaction {
    const original = this.transactions.find((t) => t.id === transactionId);
    if (!original) throw new Error(`Unknown transaction ${transactionId}`);
    if (original.type === 'ROLLBACK') throw new Error('Cannot roll back a rollback');

    const already = this.transactions.find(
      (t) => t.type === 'ROLLBACK' && t.reference === `rollback:${transactionId}`,
    );
    if (already) return already;

    const delta = original.type === 'DEBIT' ? original.amount : -original.amount;
    const tx: Transaction = {
      id: createTransactionId('rbk'),
      type: 'ROLLBACK',
      amount: original.amount,
      balanceBefore: this.balance,
      balanceAfter: money(this.balance + delta),
      timestamp: Date.now(),
      reference: `rollback:${transactionId}`,
    };
    this.balance = tx.balanceAfter;
    this.commit(tx, tx.reference);
    return tx;
  }

  getTransactions(limit = 100): Transaction[] {
    return this.transactions.slice(-limit).reverse();
  }

  /** demo helper — top up the play money balance */
  reset(balance: number): void {
    this.balance = money(balance);
  }

  private commit(tx: Transaction, reference: string): void {
    this.transactions.push(tx);
    this.byReference.set(reference, tx);
    if (this.transactions.length > 5000) this.transactions.splice(0, 1000);
  }
}
