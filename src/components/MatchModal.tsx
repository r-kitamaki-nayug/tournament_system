import { useState } from 'react';
import { Match, Participant } from '../types';

interface Props {
  match: Match;
  participant1?: Participant;
  participant2?: Participant;
  onClose: () => void;
  onRecord: (matchId: string, winnerId: string, score?: string) => void;
}

export default function MatchModal({ match, participant1, participant2, onClose, onRecord }: Props) {
  const [selectedWinner, setSelectedWinner] = useState<string>(match.winnerId ?? '');
  const [score, setScore] = useState(match.score ?? '');

  const handleSubmit = () => {
    if (!selectedWinner) return;
    onRecord(match.id, selectedWinner, score || undefined);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-1">試合結果を入力</h2>
          <p className="text-sm text-gray-500 mb-6">
            第{match.round}ラウンド・第{match.position + 1}試合
          </p>

          {/* 選手選択 */}
          <div className="space-y-3 mb-6">
            <p className="text-sm font-medium text-gray-600">勝者を選択してください</p>
            {[participant1, participant2].map((p, i) => {
              if (!p) return null;
              const isSelected = selectedWinner === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedWinner(p.id)}
                  className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                  }`}
                >
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    isSelected ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'
                  }`}>
                    {i + 1}
                  </span>
                  <div className="text-left">
                    <div className="font-semibold text-gray-800">{p.name}</div>
                    {p.affiliation && <div className="text-xs text-gray-500">{p.affiliation}</div>}
                  </div>
                  {isSelected && (
                    <span className="ml-auto text-blue-500 font-bold text-lg">✓</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* スコア入力 */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-600 mb-1">スコア（任意）</label>
            <input
              type="text"
              value={score}
              onChange={e => setScore(e.target.value)}
              placeholder="例: 6-3"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          {/* ボタン */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 border border-gray-300 text-gray-600 font-medium py-2.5 rounded-xl hover:bg-gray-50 transition"
            >
              キャンセル
            </button>
            <button
              onClick={handleSubmit}
              disabled={!selectedWinner}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold py-2.5 rounded-xl transition"
            >
              結果を確定
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
