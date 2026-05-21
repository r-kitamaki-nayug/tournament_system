import { useState } from 'react';
import { Match, Participant, Tournament } from '../types';
import { getRounds } from '../utils/bracketGenerator';
import MatchModal from './MatchModal';

interface Props {
  tournament: Tournament;
  interactive?: boolean;
  showViewToggle?: boolean;
  onRecordResult?: (matchId: string, winnerId: string, score?: string) => void;
  onSwapParticipants?: (matchId1: string, slot1: 1 | 2, matchId2: string, slot2: 1 | 2) => void;
}

interface DragTarget { matchId: string; slot: 1 | 2; }

type ViewMode = 'standard' | 'block' | 'tree';

// ─── カード表示レイアウト定数 ──────────────────────────────
const ROW_H      = 40;
const SCORE_H    = 20;
const MATCH_H    = ROW_H * 2 + SCORE_H;
const CELL_H     = 66;
const CARD_W     = 168;
const COL_GAP    = 36;
const COL_TOTAL  = CARD_W + COL_GAP;
const HEADER_H   = 56;

// Y 中心（カード表示共通）
function matchCenterY(round: number, pos: number): number {
  return CELL_H * Math.pow(2, round - 1) * (2 * pos + 1);
}

function roundLabel(round: number, total: number): string {
  if (round === total) return '決勝';
  if (round === total - 1) return '準決勝';
  if (round === total - 2) return '準々決勝';
  return `第${round}回戦`;
}

// ─── ツリー表示レイアウト定数 ──────────────────────────────
const T_NAME_W = 152;
const T_LINE_W = 68;
const T_SLOT_H = 32;

function tSlotY(i: number)                { return (i + 0.5) * T_SLOT_H; }
function tMatchY(r: number, p: number)    { return T_SLOT_H * Math.pow(2, r - 1) * (2 * p + 1); }
function tMatchX(r: number)               { return T_NAME_W + T_LINE_W * r; }

// ─────────────────────────────────────────────────────────

export default function BracketView({
  tournament,
  interactive = false,
  showViewToggle = false,
  onRecordResult,
  onSwapParticipants,
}: Props) {
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [dragSrc, setDragSrc]   = useState<DragTarget | null>(null);
  const [dragOver, setDragOver] = useState<DragTarget | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('standard');

  const { matches, participants } = tournament;
  if (matches.length === 0) {
    return <p className="text-gray-400 text-center py-12">トーナメント表がまだ生成されていません</p>;
  }

  const totalRounds = getRounds(matches);
  const slotCount   = Math.pow(2, totalRounds);
  const totalHeight = slotCount * CELL_H;

  const blockViewHeight = (slotCount / 2) * CELL_H;
  const blockHalf  = (totalRounds - 1) * COL_TOTAL;
  const blockTotal = 2 * blockHalf + CARD_W;

  function isBlockB(m: { round: number; position: number }): boolean {
    if (m.round >= totalRounds) return false;
    return m.position >= Math.pow(2, totalRounds - m.round - 1);
  }

  function getMatchX(m: { round: number; position: number }): number {
    if (viewMode === 'standard') return (m.round - 1) * COL_TOTAL;
    if (m.round === totalRounds) return blockHalf;
    if (isBlockB(m)) return blockTotal - CARD_W - (m.round - 1) * COL_TOTAL;
    return (m.round - 1) * COL_TOTAL;
  }

  function getMatchY(m: { round: number; position: number }): number {
    if (viewMode !== 'block') return matchCenterY(m.round, m.position);
    if (m.round >= totalRounds) return CELL_H * Math.pow(2, totalRounds - 2);
    if (isBlockB(m)) {
      const offset = Math.pow(2, totalRounds - m.round - 1);
      return matchCenterY(m.round, m.position - offset);
    }
    return matchCenterY(m.round, m.position);
  }

  function getMatchTopY(m: { round: number; position: number }): number {
    return getMatchY(m) - MATCH_H / 2;
  }

  const currentWidth  = viewMode === 'block' ? blockTotal : totalRounds * COL_TOTAL + CARD_W;
  const currentHeight = viewMode === 'block' ? blockViewHeight : totalHeight;

  const getParticipant = (id?: string): Participant | undefined =>
    id ? participants.find(p => p.id === id) : undefined;

  const isDraft   = tournament.status === 'draft';
  const canDrag   = interactive && isDraft && !!onSwapParticipants;
  const canClick  = interactive && !isDraft && !!onRecordResult;

  const handleDragStart = (matchId: string, slot: 1 | 2) => {
    if (!canDrag) return;
    setDragSrc({ matchId, slot });
  };

  const handleDrop = (targetMatchId: string, targetSlot: 1 | 2) => {
    setDragOver(null);
    if (!dragSrc || !onSwapParticipants) return;
    const targetMatch = matches.find(m => m.id === targetMatchId);
    if (!targetMatch || targetMatch.round !== 1) { setDragSrc(null); return; }
    onSwapParticipants(dragSrc.matchId, dragSrc.slot, targetMatchId, targetSlot);
    setDragSrc(null);
  };

  const handleMatchClick = (match: Match) => {
    if (!canClick) return;
    if (match.isBye || !match.participant1Id || !match.participant2Id) return;
    setSelectedMatch(match);
  };

  // ─── ツリー表示 SVG ───────────────────────────────────────
  const treeView = (() => {
    const r1Sorted = matches
      .filter(m => m.round === 1)
      .sort((a, b) => a.position - b.position);

    const slotParts: Array<Participant | undefined> = new Array(slotCount).fill(undefined);
    r1Sorted.forEach(m => {
      slotParts[m.position * 2]     = getParticipant(m.participant1Id);
      slotParts[m.position * 2 + 1] = getParticipant(m.participant2Id);
    });

    const treeTotalH = slotCount * T_SLOT_H;
    const treeTotalW = T_NAME_W + T_LINE_W * (totalRounds + 1) + 80;

    const els: React.ReactElement[] = [];

    // スロット水平線 + 名前ラベル
    for (let i = 0; i < slotCount; i++) {
      const y = tSlotY(i);
      const p = slotParts[i];

      els.push(
        <line key={`sl-${i}`}
          x1={T_NAME_W} y1={y} x2={tMatchX(1)} y2={y}
          stroke="#94a3b8" strokeWidth={1.5} strokeLinecap="round" />
      );

      if (p) {
        const hasAff = !!p.affiliation;
        els.push(
          <text key={`nt-${i}`}
            x={T_NAME_W - 7} y={y + (hasAff ? -1 : 4)}
            textAnchor="end" fontSize={11} fill="#111827">
            {p.name}
          </text>
        );
        if (hasAff) {
          els.push(
            <text key={`na-${i}`}
              x={T_NAME_W - 7} y={y + 10}
              textAnchor="end" fontSize={9} fill="#9ca3af">
              {p.affiliation}
            </text>
          );
        }
      }
    }

    // ラウンドコネクター
    for (let r = 1; r <= totalRounds; r++) {
      const rMatches = matches
        .filter(m => m.round === r)
        .sort((a, b) => a.position - b.position);

      for (const m of rMatches) {
        const x    = tMatchX(r);
        const midY = tMatchY(r, m.position);
        const topY = r === 1 ? tSlotY(m.position * 2)     : tMatchY(r - 1, m.position * 2);
        const botY = r === 1 ? tSlotY(m.position * 2 + 1) : tMatchY(r - 1, m.position * 2 + 1);

        const won    = !isDraft && !!m.winnerId;
        const stroke = won ? '#4ade80' : '#94a3b8';
        const sw     = won ? 2 : 1.5;

        // 縦線
        els.push(
          <line key={`v-${r}-${m.position}`}
            x1={x} y1={topY} x2={x} y2={botY}
            stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
        );

        // 次ラウンドへの横線
        const nextX = r < totalRounds ? tMatchX(r + 1) : x + T_LINE_W;
        els.push(
          <line key={`h-${r}-${m.position}`}
            x1={x} y1={midY} x2={nextX} y2={midY}
            stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
        );

        // クリック可能エリア（試合進行中・未確定マッチ）
        if (canClick && !m.isBye && m.participant1Id && m.participant2Id && !m.winnerId) {
          els.push(
            <rect key={`ca-${m.id}`}
              x={x - 12} y={topY - 4} width={24} height={botY - topY + 8}
              fill="rgba(59,130,246,0.06)" rx={4} style={{ cursor: 'pointer' }}
              onClick={() => handleMatchClick(m)} />
          );
        }
      }
    }

    // 優勝ラベル
    const finalM  = matches.find(m => m.round === totalRounds);
    const winnerP = getParticipant(finalM?.winnerId);
    if (winnerP) {
      const wx = tMatchX(totalRounds) + T_LINE_W + 8;
      const wy = tMatchY(totalRounds, 0);
      els.push(
        <text key="winner-label" x={wx} y={wy + 4}
          fontSize={12} fill="#16a34a" fontWeight="bold">
          🏆 {winnerP.name}
        </text>
      );
    }

    return (
      <div className="overflow-x-auto overflow-y-auto px-6 py-4">
        <svg width={treeTotalW} height={treeTotalH} style={{ display: 'block' }}>
          {els}
        </svg>
      </div>
    );
  })();

  // ─── SVG 接続線（カード表示用） ──────────────────────────
  const connectors = matches
    .filter(m => m.round < totalRounds)
    .map(m => {
      const parentPos = Math.floor(m.position / 2);
      const parent    = { round: m.round + 1, position: parentPos };
      const mX  = getMatchX(m);
      const pX  = getMatchX(parent);
      const srcY = getMatchY(m);
      const dstY = getMatchY(parent);
      const won  = !isDraft && !!m.winnerId;

      const inBlockB = viewMode === 'block' && isBlockB(m);
      const srcX = inBlockB ? mX          : mX + CARD_W;
      const dstX = inBlockB ? pX + CARD_W : pX;
      const midX = inBlockB ? srcX - COL_GAP / 2 : srcX + COL_GAP / 2;

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

  // ─── ラウンドヘッダー ─────────────────────────────────
  const roundHeaders = Array.from({ length: totalRounds }, (_, i) => i + 1).flatMap(round => {
    if (viewMode === 'block') {
      if (round === totalRounds) {
        return [(
          <div key={`r${round}-center`}
            style={{ position: 'absolute', top: 0, left: blockHalf, width: CARD_W, height: HEADER_H,
                     display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 6 }}
            className="text-xs font-bold text-gray-700"
          >決勝</div>
        )];
      }
      const axPos = (round - 1) * COL_TOTAL;
      const bxPos = blockTotal - CARD_W - (round - 1) * COL_TOTAL;
      return [
        <div key={`r${round}-A`}
          style={{ position: 'absolute', top: 0, left: axPos, width: CARD_W, height: HEADER_H,
                   display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 6 }}
          className="text-xs font-bold text-gray-500"
        >
          {round === 1 && <span className="text-blue-600 text-sm mb-0.5">Aブロック</span>}
          {roundLabel(round, totalRounds)}
        </div>,
        <div key={`r${round}-B`}
          style={{ position: 'absolute', top: 0, left: bxPos, width: CARD_W, height: HEADER_H,
                   display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 6 }}
          className="text-xs font-bold text-gray-500"
        >
          {round === 1 && <span className="text-orange-500 text-sm mb-0.5">Bブロック</span>}
          {roundLabel(round, totalRounds)}
        </div>,
      ];
    }
    return [(
      <div key={`r${round}`}
        style={{ position: 'absolute', top: 0, left: (round - 1) * COL_TOTAL, width: CARD_W, height: HEADER_H,
                 display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 6 }}
        className="text-xs font-bold text-gray-500 uppercase tracking-wide"
      >
        {roundLabel(round, totalRounds)}
      </div>
    )];
  });

  // ─── マッチカード ─────────────────────────────────────
  const matchCards = matches.map(match => {
    const top  = getMatchTopY(match);
    const left = getMatchX(match);
    const p1   = getParticipant(match.participant1Id);
    const p2   = getParticipant(match.participant2Id);

    const hasResult   = !isDraft && !!match.winnerId;
    const bothReady   = !!match.participant1Id && !!match.participant2Id;
    const isByeMatch  = !!match.isBye;
    // ドラフト中はBYEを通常枠として扱う（入れ替え可能にする）
    const showAsBye   = isByeMatch && !isDraft;
    const isClickable = canClick && bothReady && !isByeMatch;

    let borderClass = 'border-gray-200';
    if (showAsBye)         borderClass = 'border-gray-100';
    else if (hasResult)    borderClass = 'border-green-300';
    else if (isClickable)  borderClass = 'border-blue-300 cursor-pointer hover:border-blue-500 hover:shadow-md';
    else if (!bothReady && !isDraft) borderClass = 'border-dashed border-gray-200';

    return (
      <div
        key={match.id}
        onClick={() => handleMatchClick(match)}
        style={{ position: 'absolute', top, left, width: CARD_W, height: MATCH_H }}
        className={`rounded-lg border-2 overflow-hidden bg-white shadow-sm transition-all ${borderClass} ${showAsBye ? 'opacity-50' : ''}`}
      >
        <SlotRow
          participant={p1}
          isWinner={!isDraft && !!match.winnerId && match.winnerId === p1?.id}
          isLoser={!isDraft && !!match.winnerId && match.winnerId !== p1?.id && !!p1}
          isBye={showAsBye}
          canDrag={canDrag && match.round === 1}
          matchId={match.id} slot={1}
          isDragOver={dragOver?.matchId === match.id && dragOver?.slot === 1}
          onDragStart={handleDragStart}
          onDragOver={e => { e.preventDefault(); if (match.round === 1) setDragOver({ matchId: match.id, slot: 1 }); }}
          onDragLeave={() => setDragOver(null)}
          onDrop={handleDrop}
        />
        <ScoreRow score={match.score} hasResult={hasResult} bothReady={bothReady} isBye={showAsBye} />
        <SlotRow
          participant={p2}
          isWinner={!isDraft && !!match.winnerId && match.winnerId === p2?.id}
          isLoser={!isDraft && !!match.winnerId && match.winnerId !== p2?.id && !!p2}
          isBye={showAsBye}
          canDrag={canDrag && match.round === 1}
          matchId={match.id} slot={2}
          isDragOver={dragOver?.matchId === match.id && dragOver?.slot === 2}
          onDragStart={handleDragStart}
          onDragOver={e => { e.preventDefault(); if (match.round === 1) setDragOver({ matchId: match.id, slot: 2 }); }}
          onDragLeave={() => setDragOver(null)}
          onDrop={handleDrop}
        />
      </div>
    );
  });

  // ─── 優勝バナー（カード表示用） ──────────────────────────
  const finalMatch = matches.find(m => m.round === totalRounds);
  const winner     = getParticipant(finalMatch?.winnerId);
  const winnerBanner = winner ? (
    <div
      style={{
        position: 'absolute',
        top: HEADER_H + getMatchTopY({ round: totalRounds, position: 0 }) - 8,
        left: getMatchX({ round: totalRounds, position: 0 }) + CARD_W + 16,
      }}
      className="bg-yellow-50 border-2 border-yellow-400 rounded-xl px-4 py-3 shadow text-center"
    >
      <div className="text-2xl mb-1">🏆</div>
      <div className="font-bold text-gray-800">{winner.name}</div>
      {winner.affiliation && <div className="text-xs text-gray-500">{winner.affiliation}</div>}
      <div className="text-xs text-yellow-600 font-semibold mt-1">優勝</div>
    </div>
  ) : null;

  // ─── レンダリング ─────────────────────────────────────
  return (
    <div>
      {/* ビュー切り替えボタン */}
      {showViewToggle && (
        <div className="flex justify-end mb-3 px-6 print:hidden">
          <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden text-sm">
            <button
              onClick={() => setViewMode('standard')}
              className={`px-4 py-1.5 font-medium transition ${viewMode === 'standard' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              標準
            </button>
            <button
              onClick={() => setViewMode('block')}
              className={`px-4 py-1.5 font-medium transition border-l border-gray-200 ${viewMode === 'block' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              ブロック
            </button>
            <button
              onClick={() => setViewMode('tree')}
              className={`px-4 py-1.5 font-medium transition border-l border-gray-200 ${viewMode === 'tree' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              ライン
            </button>
          </div>
        </div>
      )}

      {/* ブラケット本体 */}
      {viewMode === 'tree' ? treeView : (
        <div className="overflow-x-auto overflow-y-auto px-6 py-4">
          <div style={{ position: 'relative', width: currentWidth, height: currentHeight + HEADER_H, minWidth: currentWidth }}>
            {roundHeaders}
            <svg
              style={{ position: 'absolute', top: HEADER_H, left: 0, width: currentWidth, height: currentHeight, overflow: 'visible', pointerEvents: 'none' }}
            >
              {connectors}
            </svg>
            <div style={{ position: 'absolute', top: HEADER_H, left: 0, width: currentWidth, height: currentHeight }}>
              {matchCards}
            </div>
            {tournament.status === 'completed' && winnerBanner}
          </div>
        </div>
      )}

      {/* 試合結果入力モーダル */}
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

// ─── サブコンポーネント ────────────────────────────────────

interface SlotRowProps {
  participant?: Participant;
  isWinner: boolean; isLoser: boolean; isBye: boolean;
  canDrag: boolean; matchId: string; slot: 1 | 2; isDragOver: boolean;
  onDragStart: (matchId: string, slot: 1 | 2) => void;
  onDragOver:  (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop:      (matchId: string, slot: 1 | 2) => void;
}

function SlotRow({ participant, isWinner, isLoser, isBye, canDrag,
  matchId, slot, isDragOver, onDragStart, onDragOver, onDragLeave, onDrop }: SlotRowProps) {
  const draggable = canDrag && !!participant;

  let bg        = 'bg-white';
  let textColor = 'text-gray-700';
  if (isDragOver)  { bg = 'bg-blue-100'; }
  else if (isWinner) { bg = 'bg-green-50'; textColor = 'text-green-800 font-bold'; }
  else if (isLoser)  { bg = 'bg-gray-50';  textColor = 'text-gray-400'; }
  else if (isBye || !participant) { textColor = 'text-gray-400 italic'; }

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

interface ScoreRowProps {
  score?: string;
  hasResult: boolean;
  bothReady: boolean;
  isBye: boolean;
}

function ScoreRow({ score, hasResult, bothReady, isBye }: ScoreRowProps) {
  return (
    <div
      style={{ height: SCORE_H }}
      className="border-t border-b border-gray-200 flex items-center justify-center px-2"
    >
      {hasResult && score ? (
        <span className="text-xs font-medium text-gray-500 bg-gray-50 px-2 py-0.5 rounded">
          {score}
        </span>
      ) : hasResult && !score ? (
        <span className="text-xs text-green-400">確定</span>
      ) : bothReady && !isBye ? (
        <span className="text-xs text-gray-300">vs</span>
      ) : null}
    </div>
  );
}
