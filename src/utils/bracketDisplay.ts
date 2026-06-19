import { Match, Tournament } from '../types';
import { getRounds } from './bracketGenerator';

/** 試合進行中: 不戦勝の第1回戦カードを隠し、左の名前＋実戦のみの列構成にする */
export interface SimplifiedBracketView {
  useSimplified: boolean;
  totalColumns: number;
  showMatchCard: (m: Match) => boolean;
  columnForMatch: (m: Match) => number;
}

export interface ByeSlotEntry {
  slotIndex: number;
  participantId: string;
  /** データ上の第1回戦マッチ（ドラッグ用・参照用） */
  r1MatchId: string;
  r1Slot: 1 | 2;
}

export function buildSimplifiedBracketView(tournament: Tournament): SimplifiedBracketView {
  const { matches, status } = tournament;
  const totalRounds = getRounds(matches);
  const useSimplified = status === 'active' || status === 'completed';

  const showMatchCard = (m: Match) => {
    if (!useSimplified) return true;
    return !(m.round === 1 && m.isBye);
  };

  const columnForMatch = (m: Match) => m.round;

  return {
    useSimplified,
    totalColumns: totalRounds,
    showMatchCard,
    columnForMatch,
  };
}

export function getByeSlotEntries(
  matches: Match[],
  useSimplified: boolean,
): ByeSlotEntry[] {
  if (!useSimplified) return [];

  const entries: ByeSlotEntry[] = [];
  for (const m of matches) {
    if (m.round !== 1 || !m.isBye) continue;
    const pid = m.participant1Id ?? m.participant2Id;
    if (!pid) continue;
    const slotIndex = m.participant1Id ? m.position * 2 : m.position * 2 + 1;
    entries.push({
      slotIndex,
      participantId: pid,
      r1MatchId: m.id,
      r1Slot: m.participant1Id ? 1 : 2,
    });
  }
  return entries;
}

const CELL_H = 66;

export function slotCenterY(slotIndex: number): number {
  return CELL_H * (slotIndex + 0.5);
}
