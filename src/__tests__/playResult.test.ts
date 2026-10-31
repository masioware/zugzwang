import { describe, expect, it } from 'vitest';
import { gameOver } from '../play/result';

describe('bot game result', () => {
  it('is null while the game goes on', () => {
    expect(gameOver(['e4', 'e5'], 'white')).toBeNull();
  });

  it('scores a checkmate for the right side', () => {
    const fools = ['f3', 'e5', 'g4', 'Qh4#'];
    expect(gameOver(fools, 'white')).toEqual({ outcome: 'loss', termination: 'checkmate' });
    expect(gameOver(fools, 'black')).toEqual({ outcome: 'win', termination: 'checkmate' });
  });

  it('detects stalemate and repetition as draws', () => {
    // Shortest known stalemate (Sam Loyd).
    const stalemate = ['e3', 'a5', 'Qh5', 'Ra6', 'Qxa5', 'h5', 'h4', 'Rah6', 'Qxc7', 'f6', 'Qxd7+', 'Kf7', 'Qxb7', 'Qd3', 'Qxb8', 'Qh7', 'Qxc8', 'Kg6', 'Qe6'];
    expect(gameOver(stalemate, 'white')).toEqual({ outcome: 'draw', termination: 'stalemate' });
    const repeat = ['Nf3', 'Nf6', 'Ng1', 'Ng8', 'Nf3', 'Nf6', 'Ng1', 'Ng8'];
    expect(gameOver(repeat, 'white')).toEqual({ outcome: 'draw', termination: 'repetition' });
  });
});
