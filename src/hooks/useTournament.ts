import { useCallback } from 'react';
import { AppState, Tournament, Participant, Match } from '../types';
import { useLocalStorage } from './useLocalStorage';
import { generateBracket, shuffleParticipantsInBracket, propagateByes } from '../utils/bracketGenerator';
import { mergeIntoAppState } from '../utils/exportImport';

const STORAGE_KEY = 'tournament-app-state';

const initialState: AppState = {
  tournaments: [],
  currentTournamentId: undefined,
};

export function useTournament() {
  const [appState, setAppState] = useLocalStorage<AppState>(STORAGE_KEY, initialState);

  const currentTournament = appState.tournaments.find(
    t => t.id === appState.currentTournamentId
  ) ?? null;

  const updateCurrentTournament = useCallback((updater: (t: Tournament) => Tournament) => {
    setAppState(prev => ({
      ...prev,
      tournaments: prev.tournaments.map(t =>
        t.id === prev.currentTournamentId ? updater(t) : t
      ),
    }));
  }, [setAppState]);

  // 新しいトーナメントを作成
  const createTournament = useCallback((name: string, date: string) => {
    const newTournament: Tournament = {
      id: crypto.randomUUID(),
      name,
      date,
      participants: [],
      matches: [],
      status: 'draft',
    };
    setAppState(prev => ({
      ...prev,
      tournaments: [...prev.tournaments, newTournament],
      currentTournamentId: newTournament.id,
    }));
    return newTournament.id;
  }, [setAppState]);

  // 既存トーナメントを選択
  const selectTournament = useCallback((id: string) => {
    setAppState(prev => ({ ...prev, currentTournamentId: id }));
  }, [setAppState]);

  // 大会情報を更新
  const updateTournamentInfo = useCallback((name: string, date: string) => {
    updateCurrentTournament(t => ({ ...t, name, date }));
  }, [updateCurrentTournament]);

  // 参加者を追加
  const addParticipant = useCallback((participant: Omit<Participant, 'id'>) => {
    updateCurrentTournament(t => ({
      ...t,
      participants: [...t.participants, { ...participant, id: crypto.randomUUID() }],
    }));
  }, [updateCurrentTournament]);

  // 参加者を更新
  const updateParticipant = useCallback((id: string, data: Partial<Participant>) => {
    updateCurrentTournament(t => ({
      ...t,
      participants: t.participants.map(p => p.id === id ? { ...p, ...data } : p),
    }));
  }, [updateCurrentTournament]);

  // 参加者を削除
  const removeParticipant = useCallback((id: string) => {
    updateCurrentTournament(t => ({
      ...t,
      participants: t.participants.filter(p => p.id !== id),
    }));
  }, [updateCurrentTournament]);

  // 参加者を一括セット（CSVインポート用）
  const setParticipants = useCallback((participants: Participant[]) => {
    updateCurrentTournament(t => ({ ...t, participants }));
  }, [updateCurrentTournament]);

  // トーナメント表を生成（ステップ1→2）
  const generateTournamentBracket = useCallback(() => {
    if (!currentTournament) return;
    const matches = generateBracket(currentTournament.participants);
    updateCurrentTournament(t => ({ ...t, matches, status: 'draft' }));
  }, [currentTournament, updateCurrentTournament]);

  // シャッフル（シード位置を維持しシードなし参加者のみランダム）
  const shuffleBracket = useCallback(() => {
    if (!currentTournament) return;
    const matches = shuffleParticipantsInBracket(currentTournament.participants);
    updateCurrentTournament(t => ({ ...t, matches }));
  }, [currentTournament, updateCurrentTournament]);

  // 試合開始（ステップ2→3）
  const startTournament = useCallback(() => {
    updateCurrentTournament(t => ({ ...t, status: 'active' }));
  }, [updateCurrentTournament]);

  // 試合結果を記録
  const recordMatchResult = useCallback((matchId: string, winnerId: string, score?: string) => {
    if (!currentTournament) return;

    const updatedMatches = currentTournament.matches.map(m =>
      m.id === matchId ? { ...m, winnerId, score } : m
    );

    // 次ラウンドのマッチに勝者を伝播
    const match = currentTournament.matches.find(m => m.id === matchId);
    if (match) {
      const nextPos = Math.floor(match.position / 2);
      const nextRound = match.round + 1;
      const nextMatchIdx = updatedMatches.findIndex(
        m => m.round === nextRound && m.position === nextPos
      );
      if (nextMatchIdx !== -1) {
        const isLeft = match.position % 2 === 0;
        updatedMatches[nextMatchIdx] = {
          ...updatedMatches[nextMatchIdx],
          participant1Id: isLeft ? winnerId : updatedMatches[nextMatchIdx].participant1Id,
          participant2Id: !isLeft ? winnerId : updatedMatches[nextMatchIdx].participant2Id,
        };
      }
    }

    // 全試合が終了したか確認
    const maxRound = Math.max(...updatedMatches.map(m => m.round));
    const finalMatch = updatedMatches.find(m => m.round === maxRound);
    const isCompleted = finalMatch?.winnerId != null;

    updateCurrentTournament(t => ({
      ...t,
      matches: propagateByes(updatedMatches),
      status: isCompleted ? 'completed' : 'active',
    }));
  }, [currentTournament, updateCurrentTournament]);

  // 参加者ドラッグ&ドロップ入れ替え（ステップ2）
  const swapParticipantsInBracket = useCallback((matchId1: string, slot1: 1 | 2, matchId2: string, slot2: 1 | 2) => {
    if (!currentTournament) return;

    const m1 = currentTournament.matches.find(m => m.id === matchId1);
    const m2 = currentTournament.matches.find(m => m.id === matchId2);
    if (!m1 || !m2) return;

    const id1 = slot1 === 1 ? m1.participant1Id : m1.participant2Id;
    const id2 = slot2 === 1 ? m2.participant1Id : m2.participant2Id;

    // BYEを再計算してround1マッチを更新するヘルパー
    const patchR1 = (m: Match, p1: string | undefined, p2: string | undefined): Match => {
      const isBye = (!!p1 && !p2) || (!p1 && !!p2);
      return { ...m, participant1Id: p1, participant2Id: p2, isBye, winnerId: isBye ? (p1 ?? p2) : undefined };
    };

    const updatedMatches = currentTournament.matches.map(m => {
      // 上位ラウンドは必ずクリア → propagateByes で再計算
      if (m.round > 1) {
        return { ...m, participant1Id: undefined, participant2Id: undefined, winnerId: undefined, isBye: false };
      }

      // 同一マッチ内でのスワップ
      if (matchId1 === matchId2 && m.id === matchId1) {
        const newP1 = slot1 === 1 ? id2 : (slot2 === 1 ? id1 : m.participant1Id);
        const newP2 = slot1 === 2 ? id2 : (slot2 === 2 ? id1 : m.participant2Id);
        return patchR1(m, newP1, newP2);
      }

      if (m.id === matchId1) {
        return patchR1(
          m,
          slot1 === 1 ? id2 : m.participant1Id,
          slot1 === 2 ? id2 : m.participant2Id,
        );
      }
      if (m.id === matchId2) {
        return patchR1(
          m,
          slot2 === 1 ? id1 : m.participant1Id,
          slot2 === 2 ? id1 : m.participant2Id,
        );
      }
      return m;
    });

    updateCurrentTournament(t => ({ ...t, matches: propagateByes(updatedMatches) }));
  }, [currentTournament, updateCurrentTournament]);

  // JSONインポート
  const importTournament = useCallback((tournament: Tournament) => {
    setAppState(prev => ({
      ...mergeIntoAppState(prev, tournament),
      currentTournamentId: tournament.id,
    }));
  }, [setAppState]);

  // トーナメントを削除
  const deleteTournament = useCallback((id: string) => {
    setAppState(prev => {
      const next = {
        ...prev,
        tournaments: prev.tournaments.filter(t => t.id !== id),
      };
      if (prev.currentTournamentId === id) {
        next.currentTournamentId = next.tournaments[0]?.id;
      }
      return next;
    });
  }, [setAppState]);

  const getParticipantById = useCallback((id?: string) => {
    if (!id || !currentTournament) return undefined;
    return currentTournament.participants.find(p => p.id === id);
  }, [currentTournament]);

  const getWinner = useCallback(() => {
    if (!currentTournament || currentTournament.status !== 'completed') return undefined;
    const maxRound = Math.max(...currentTournament.matches.map(m => m.round));
    const finalMatch = currentTournament.matches.find(m => m.round === maxRound);
    return getParticipantById(finalMatch?.winnerId);
  }, [currentTournament, getParticipantById]);

  return {
    appState,
    currentTournament,
    createTournament,
    selectTournament,
    updateTournamentInfo,
    addParticipant,
    updateParticipant,
    removeParticipant,
    setParticipants,
    generateTournamentBracket,
    shuffleBracket,
    startTournament,
    recordMatchResult,
    swapParticipantsInBracket,
    importTournament,
    deleteTournament,
    getParticipantById,
    getWinner,
  };
}
