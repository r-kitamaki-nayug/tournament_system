import { Tournament, AppState } from '../types';

export function exportTournamentJson(tournament: Tournament): void {
  const json = JSON.stringify(tournament, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tournament_${tournament.name}_${tournament.date}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function importTournamentJson(file: File): Promise<Tournament> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string) as Tournament;
        if (!data.id || !data.name || !Array.isArray(data.participants)) {
          throw new Error('有効なトーナメントデータではありません');
        }
        resolve(data);
      } catch {
        reject(new Error('JSONファイルの読み込みに失敗しました。形式を確認してください。'));
      }
    };
    reader.onerror = () => reject(new Error('ファイルの読み込みに失敗しました'));
    reader.readAsText(file);
  });
}

export function mergeIntoAppState(state: AppState, incoming: Tournament): AppState {
  const exists = state.tournaments.find(t => t.id === incoming.id);
  if (exists) {
    return {
      ...state,
      tournaments: state.tournaments.map(t => t.id === incoming.id ? incoming : t),
    };
  }
  return {
    ...state,
    tournaments: [...state.tournaments, incoming],
  };
}
