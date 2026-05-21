import { Participant, Match } from '../types';

function nextPowerOfTwo(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

// Returns [seedNumber, ...] indexed by slot position
// e.g. seededSlotOrder(4) = [1, 4, 2, 3]
// → slot0=seed1, slot1=seed4, slot2=seed2, slot3=seed3
// Pairs: (1vs4), (2vs3) → SF: 1-side vs 2-side ✓
function seededSlotOrder(n: number): number[] {
  if (n === 2) return [1, 2];
  const half = n / 2;
  const topHalf = seededSlotOrder(half);
  const bottomHalf = seededSlotOrder(half).map(s => n + 1 - s);
  const result: number[] = [];
  for (let i = 0; i < half; i++) {
    result.push(topHalf[i]);
    result.push(bottomHalf[i]);
  }
  return result;
}

// Returns slot index for each seed (0-indexed by seed-1)
function slotForSeedIndex(slotCount: number): number[] {
  const order = seededSlotOrder(slotCount);
  const result = new Array<number>(slotCount);
  order.forEach((seedNum, slotIdx) => {
    result[seedNum - 1] = slotIdx;
  });
  return result;
}

export function generateBracket(participants: Participant[]): Match[] {
  const slotCount = nextPowerOfTwo(participants.length);
  const roundCount = Math.log2(slotCount);

  const indexed = participants.map((p, i) => ({ ...p, _idx: i }));
  const seeded = indexed
    .filter(p => p.seed != null)
    .sort((a, b) => a.seed !== b.seed ? (a.seed as number) - (b.seed as number) : a._idx - b._idx);
  const unseeded = indexed
    .filter(p => p.seed == null)
    .sort((a, b) => a._idx - b._idx);

  const numByes      = slotCount - participants.length;
  const byesForSeeds = Math.min(numByes, seeded.length);
  const overflowByes = numByes - byesForSeeds;

  const slotByIdx = slotForSeedIndex(slotCount);
  const slots: (string | null)[] = new Array(slotCount).fill(null);
  const byeSlots = new Set<number>();

  // 1. シード選手を各シード位置に配置し、上位 byesForSeeds 名の隣スロットをBYEに
  seeded.forEach((p, i) => { slots[slotByIdx[i]] = p.id; });
  for (let i = 0; i < byesForSeeds; i++) {
    byeSlots.add(slotByIdx[i] ^ 1);
  }

  // 2. 溢れBYE: 無シード先着 overflowByes 名を仮想シード位置に置き隣をBYEに
  const unseededQueue = [...unseeded];
  for (let i = 0; i < overflowByes; i++) {
    const vIdx = seeded.length + i;
    slots[slotByIdx[vIdx]] = unseededQueue.shift()!.id;
    byeSlots.add(slotByIdx[vIdx] ^ 1);
  }

  // 3. 残りの無シード選手を空き（非BYE）スロットに順番に詰める
  for (let slot = 0; slot < slotCount; slot++) {
    if (slots[slot] === null && !byeSlots.has(slot)) {
      const p = unseededQueue.shift();
      if (p) slots[slot] = p.id;
    }
  }

  const matches: Match[] = [];

  for (let pos = 0; pos < slotCount / 2; pos++) {
    const p1Id = slots[pos * 2];
    const p2Id = slots[pos * 2 + 1];
    const isBye = (!!p1Id && !p2Id) || (!p1Id && !!p2Id);
    const match: Match = {
      id: `r1-${pos}`,
      round: 1,
      position: pos,
      participant1Id: p1Id ?? undefined,
      participant2Id: p2Id ?? undefined,
      isBye,
    };
    if (isBye) {
      match.winnerId = p1Id ?? p2Id ?? undefined;
    }
    matches.push(match);
  }

  for (let round = 2; round <= roundCount; round++) {
    const matchesInRound = slotCount / Math.pow(2, round);
    for (let pos = 0; pos < matchesInRound; pos++) {
      matches.push({ id: `r${round}-${pos}`, round, position: pos });
    }
  }

  return propagateByes(matches);
}

export function propagateByes(matches: Match[]): Match[] {
  const updated = matches.map(m => ({ ...m }));

  const getMatch = (round: number, pos: number) =>
    updated.find(m => m.round === round && m.position === pos);

  const maxRound = Math.max(...updated.map(m => m.round));

  for (let round = 1; round < maxRound; round++) {
    for (const match of updated.filter(m => m.round === round)) {
      if (!match.winnerId) continue;
      const nextPos = Math.floor(match.position / 2);
      const next = getMatch(round + 1, nextPos);
      if (!next) continue;
      if (match.position % 2 === 0) {
        next.participant1Id = match.winnerId;
      } else {
        next.participant2Id = match.winnerId;
      }
    }
  }

  return updated;
}

// シードを加味してシャッフル:
//   シードあり → 所定のシード配置位置をキープ
//   シードなし → ランダムに入れ替え
export function shuffleParticipantsInBracket(participants: Participant[]): Match[] {
  const seeded = participants.filter(p => p.seed != null);
  const unseeded = participants
    .filter(p => p.seed == null)
    .sort(() => Math.random() - 0.5);
  return generateBracket([...seeded, ...unseeded]);
}

export function getRounds(matches: Match[]): number {
  return Math.max(...matches.map(m => m.round));
}

export function getMatchesForRound(matches: Match[], round: number): Match[] {
  return matches.filter(m => m.round === round).sort((a, b) => a.position - b.position);
}
