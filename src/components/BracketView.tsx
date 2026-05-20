import { useState } from 'react';
import { Match, Participant, Tournament } from '../types';
import { getRounds } from '../utils/bracketGenerator';
import MatchModal from './MatchModal';

interface Props {
  tournament: Tournament;
  interactive?: boolean;
  onRecordResult?: (matchId: string, winnerId: string, score?: string) => void;
  onSwapParticipants?: (matchId1: string, slot1: 1 | 2, matchId2: string, slot2: 1 | 2) => void;
}

interface DragTarget {
  matchId: string;
  slot: 1 | 2;
}

// レイアウト定数
const ROW_H = 42;       // 参加者スロット1行の実際の高さ
const MATCH_H = ROW_H * 2;  // マッチカード高さ
const CELL_H = 56;      // Y軸ピッチ（CELL_H > ROW_H にするとマッチ間に隙間ができる）
const CARD_W = 164;     // マッチカード幅
const COL_GAP = 36;     // ラウンド間の接続線スペース
const COL_TOTAL = CARD_W + COL_GAP;
const HEADER_H = 32;

// マッチ中心Y: スロット数をCELL_Hで計算してピッチを確保
function matchCenterY(round: number, pos: number): number {
  return CELL_H * Math.pow(2, round - 1) * (2 * pos + 1);
}

function matchTopY(round: number, pos: number): number {
  return matchCenterY(round, pos) - MATCH_H / 2;
}

function matchLeftX(round: number): number {
  return (round - 1) * COL_TOTAL;
}

function roundLabel(round: number, totalRounds: number): string {
  if (round === totalRounds) return '決勝';
  if (round === totalRounds - 1) return '準決勝';
  if (round === totalRounds - 2) return '準々決勝';
  return `第${round}回戦`;
}

export default function BracketView({
  tournament,
  interactive = false,
  onRecordResult,
  onSwapParticipants,
}: Props) {
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [dragSrc, setDragSrc] = useState<DragTarget | null>(null);
  const [dragOver, setDragOver] = useState<DragTarget | null>(null);

  const { matches, participants } = tournament;
  if (matches.length === 0) {
    return <p className="text-gray-400 text-center py-12">トーナメント表がまだ生成されていません</p>;
  }

  const totalRounds = getRounds(matches);
  const slotCount = Math.pow(2, totalRounds);
  const totalHeight = slotCount * CELL_H;
  const totalWidth = totalRounds * COL_TOTAL + CARD_W;

  const getParticipant = (id?: string): Participant | undefined =>
    id ? participants.find(p => p.id === id) : undefined;

  const isDraft = tournament.status === 'draft';
  const canDrag = interactive && isDraft && !!onSwapParticipants;
  const canClick = interactive && !isDraft && !!onRecordResult;

  const handleDragStart = (matchId: string, slot: 1 | 2) => {
    if (!canDrag) return;
    setDragSrc({ matchId, slot });
  };

  const handleDrop = (targetMatchId: string, targetSlot: 1 | 2) => {
    setDragOver(null);
    if (!dragSrc || !onSwapParticipants) return;
    // ラウンド1同士の入れ替えのみ許可
    const targetMatch = matches.find(m => m.id === targetMatchId);
    if (!targetMatch || targetMatch.round !== 1) { setDragSrc(null); return; }
    onSwapParticipants(dragSrc.matchId, dragSrc.slot, targetMatchId, targetSlot);
    setDragSrc(null);
  };

  const handleMatchClick = (match: Match) => {
    if (!canClick) return;
    if (match.isBye || !match.participant1Id || !match.participant2Id) return;
    if (match.winnerId) return; // 結果済みはダブルクリックで再入力したい場合は後で対応
    setSelectedMatch(match);
  };

  // SVG接続線
  const connectors = matches
    .filter(m => m.round < totalRounds)
    .map(m => {
      const srcX = matchLeftX(m.round) + CARD_W;
      const srcY = matchCenterY(m.round, m.position);
      const parentPos = Math.floor(m.position / 2);
      const dstX = matchLeftX(m.round + 1);
      const dstY = matchCenterY(m.round + 1, parentPos);
      const midX = srcX + COL_GAP / 2;
      const won = !!m.winnerId;

      return (
        <path
          key={m.id}
          d={`M ${srcX} ${srcY} H ${midX} V ${dstY} H ${dstX}`}
          fill="none"
          stroke={won ? '#86efac' : '#e2e8f0'}
          strokeWidth={won ? 2.5 : 1.5}
        />
      );
    });

  return (
    <div className="overflow-x-auto overflow-y-auto">
      <div
        style={{
          position: 'relative',
          width: totalWidth,
          height: totalHeight + HEADER_H,
          minWidth: totalWidth,
        }}
      >
        {/* ラウンドヘッダー */}
        {Array.from({ length: totalRounds }, (_, i) => i + 1).map(round => (
          <div
            key={round}
            style={{
              position: 'absolute',
              top: 0,
              left: matchLeftX(round),
              width: CARD_W,
              height: HEADER_H,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            className="text-xs font-bold text-gray-500 uppercase tracking-wide"
          >
            {roundLabel(round, totalRounds)}
          </div>
        ))}

        {/* SVG接続線レイヤー */}
        <svg
          style={{
            position: 'absolute',
            top: HEADER_H,
            left: 0,
            width: totalWidth,
            height: totalHeight,
            overflow: 'visible',
            pointerEvents: 'none',
          }}
        >
          {connectors}
        </svg>

        {/* マッチカード */}
        <div style={{ position: 'absolute', top: HEADER_H, left: 0, width: totalWidth, height: totalHeight }}>
          {matches.map(match => {
            const top = matchTopY(match.round, match.position);
            const left = matchLeftX(match.round);
            const p1 = getParticipant(match.participant1Id);
            const p2 = getParticipant(match.participant2Id);

            const hasResult = !!match.winnerId;
            const bothReady = !!match.participant1Id && !!match.participant2Id;
            const isClickable = canClick && bothReady && !match.isBye;
            const isByeMatch = !!match.isBye;
            const isWaiting = !bothReady && !isByeMatch;

            let borderClass = 'border-gray-200';
            if (isByeMatch) borderClass = 'border-gray-100';
            else if (hasResult) borderClass = 'border-green-300 bg-green-50/30';
            else if (isClickable) borderClass = 'border-blue-300 cursor-pointer hover:border-blue-500 hover:shadow-md';
            else if (isWaiting) borderClass = 'border-dashed border-gray-200';

            return (
              <div
                key={match.id}
                onClick={() => handleMatchClick(match)}
                style={{
                  position: 'absolute',
                  top,
                  left,
                  width: CARD_W,
                  height: MATCH_H,
                }}
                className={`rounded-lg border-2 overflow-hidden shadow-sm bg-white transition-all ${borderClass} ${isByeMatch ? 'opacity-50' : ''}`}
              >
                <SlotRow
                  participant={p1}
                  isWinner={!!match.winnerId && match.winnerId === p1?.id}
                  isLoser={!!match.winnerId && match.winnerId !== p1?.id && !!p1}
                  isBye={isByeMatch}
                  canDrag={canDrag && !isByeMatch && match.round === 1}
                  matchId={match.id}
                  slot={1}
                  isDragOver={dragOver?.matchId === match.id && dragOver?.slot === 1}
                  onDragStart={handleDragStart}
                  onDragOver={(e) => { e.preventDefault(); if (match.round === 1) setDragOver({ matchId: match.id, slot: 1 }); }}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={handleDrop}
                />
                <div className="border-t border-gray-200" />
                <SlotRow
                  participant={p2}
                  isWinner={!!match.winnerId && match.winnerId === p2?.id}
                  isLoser={!!match.winnerId && match.winnerId !== p2?.id && !!p2}
                  isBye={isByeMatch}
                  canDrag={canDrag && !isByeMatch && match.round === 1}
                  matchId={match.id}
                  slot={2}
                  isDragOver={dragOver?.matchId === match.id && dragOver?.slot === 2}
                  onDragStart={handleDragStart}
                  onDragOver={(e) => { e.preventDefault(); if (match.round === 1) setDragOver({ matchId: match.id, slot: 2 }); }}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={handleDrop}
                />
                {match.score && hasResult && (
                  <div
                    style={{ position: 'absolute', bottom: -18, left: 0, width: CARD_W }}
                    className="text-center text-xs text-gray-400"
                  >
                    {match.score}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 優勝者バナー */}
        {tournament.status === 'completed' && (() => {
          const finalMatch = matches.find(m => m.round === totalRounds);
          const winner = getParticipant(finalMatch?.winnerId);
          if (!winner) return null;
          return (
            <div
              style={{
                position: 'absolute',
                top: HEADER_H + matchTopY(totalRounds, 0) - 8,
                left: matchLeftX(totalRounds) + CARD_W + 16,
              }}
              className="bg-yellow-50 border-2 border-yellow-400 rounded-xl px-4 py-3 shadow-md text-center"
            >
              <div className="text-2xl mb-1">🏆</div>
              <div className="font-bold text-gray-800">{winner.name}</div>
              {winner.affiliation && <div className="text-xs text-gray-500">{winner.affiliation}</div>}
              <div className="text-xs text-yellow-600 font-semibold mt-1">優勝</div>
            </div>
          );
        })()}
      </div>

      {selectedMatch && onRecordResult && (
        <MatchModal
          match={selectedMatch}
          participant1={getParticipant(selectedMatch.participant1Id)}
          participant2={getParticipant(selectedMatch.participant2Id)}
          onClose={() => setSelectedMatch(null)}
          onRecord={onRecordResult}
        />
      )}
    </div>
  );
}

interface SlotRowProps {
  participant?: Participant;
  isWinner: boolean;
  isLoser: boolean;
  isBye: boolean;
  canDrag: boolean;
  matchId: string;
  slot: 1 | 2;
  isDragOver: boolean;
  onDragStart: (matchId: string, slot: 1 | 2) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (matchId: string, slot: 1 | 2) => void;
}

function SlotRow({
  participant, isWinner, isLoser, isBye, canDrag,
  matchId, slot, isDragOver,
  onDragStart, onDragOver, onDragLeave, onDrop,
}: SlotRowProps) {
  const draggable = canDrag && !!participant;

  let bg = 'bg-white';
  if (isDragOver) bg = 'bg-blue-100';
  else if (isWinner) bg = 'bg-green-50';
  else if (isLoser) bg = 'bg-gray-50';
  else if (isBye) bg = 'bg-gray-50';

  let textColor = 'text-gray-700';
  if (isWinner) textColor = 'text-green-800 font-bold';
  else if (isLoser) textColor = 'text-gray-400';
  else if (isBye || !participant) textColor = 'text-gray-400 italic';

  return (
    <div
      draggable={draggable}
      onDragStart={() => draggable && onDragStart(matchId, slot)}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={() => onDrop(matchId, slot)}
      style={{ height: ROW_H }}
      className={`flex items-center gap-1.5 px-3 text-sm select-none transition-colors ${bg} ${textColor} ${draggable ? 'cursor-grab' : ''}`}
    >
      {isWinner && <span className="text-green-500 text-xs flex-shrink-0">●</span>}
      <span className="truncate" style={{ maxWidth: CARD_W - 32 }}>
        {participant?.name ?? (isBye ? 'BYE' : '―')}
      </span>
    </div>
  );
}
