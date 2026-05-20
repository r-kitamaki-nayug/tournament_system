import { useState, useRef } from 'react';
import { useTournament } from './hooks/useTournament';
import { Step } from './types';
import ParticipantEditor from './components/ParticipantEditor';
import BracketView from './components/BracketView';
import PrintView from './components/PrintView';
import { exportTournamentJson, importTournamentJson } from './utils/exportImport';

const STEP_LABELS: Record<Step, string> = {
  1: '参加者登録',
  2: '組み合わせ確認',
  3: '試合進行',
  4: '印刷',
};

export default function App() {
  const {
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
    getWinner,
  } = useTournament();

  const [step, setStep] = useState<Step>(1);
  const [importError, setImportError] = useState('');
  const importRef = useRef<HTMLInputElement>(null);

  const handleNewTournament = () => {
    const today = new Date().toISOString().split('T')[0];
    createTournament('新しい大会', today);
    setStep(1);
  };

  const handleGenerateBracket = () => {
    generateTournamentBracket();
    setStep(2);
  };

  const handleStartTournament = () => {
    startTournament();
    setStep(3);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError('');
    try {
      const t = await importTournamentJson(file);
      importTournament(t);
      setStep(t.status === 'completed' || t.status === 'active' ? 3 : 1);
    } catch (err) {
      setImportError((err as Error).message);
    }
    if (importRef.current) importRef.current.value = '';
  };

  const winner = getWinner();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white shadow-sm print:hidden">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-800">トーナメント表生成システム</h1>
          <div className="flex items-center gap-3">
            <label className="cursor-pointer text-sm text-gray-600 hover:text-blue-600 underline">
              JSONインポート
              <input
                ref={importRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleImport}
              />
            </label>
            {currentTournament && (
              <button
                onClick={() => exportTournamentJson(currentTournament)}
                className="text-sm text-gray-600 hover:text-blue-600 underline"
              >
                JSONエクスポート
              </button>
            )}
            <button
              onClick={handleNewTournament}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
            >
              ＋ 新しい大会
            </button>
          </div>
        </div>
        {importError && (
          <div className="max-w-6xl mx-auto px-4 pb-3">
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{importError}</p>
          </div>
        )}
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* 大会選択 or 開始案内 */}
        {!currentTournament ? (
          <div className="text-center py-20">
            <p className="text-gray-500 text-lg mb-6">大会がありません</p>
            {appState.tournaments.length > 0 && (
              <div className="mb-8 space-y-2">
                {appState.tournaments.map(t => (
                  <div key={t.id} className="flex items-center justify-center gap-3">
                    <button
                      onClick={() => { selectTournament(t.id); setStep(t.status === 'active' || t.status === 'completed' ? 3 : 1); }}
                      className="text-blue-600 hover:underline font-medium"
                    >
                      {t.name}（{t.date}）
                    </button>
                    <button
                      onClick={() => deleteTournament(t.id)}
                      className="text-red-400 hover:text-red-600 text-sm"
                    >削除</button>
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={handleNewTournament}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-8 py-3 rounded-xl text-lg transition shadow"
            >
              ＋ 新しい大会を始める
            </button>
          </div>
        ) : (
          <>
            {/* ステッパー */}
            <div className="flex items-center justify-center mb-8 print:hidden">
              {([1, 2, 3, 4] as Step[]).map((s, i) => (
                <div key={s} className="flex items-center">
                  <button
                    onClick={() => setStep(s)}
                    className={`flex flex-col items-center group`}
                  >
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm border-2 transition ${
                      step === s
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : s < step
                        ? 'bg-green-500 border-green-500 text-white'
                        : 'bg-white border-gray-300 text-gray-400'
                    }`}>
                      {s < step ? '✓' : s}
                    </div>
                    <span className={`text-xs mt-1 font-medium ${
                      step === s ? 'text-blue-600' : 'text-gray-400'
                    }`}>
                      {STEP_LABELS[s]}
                    </span>
                  </button>
                  {i < 3 && (
                    <div className={`w-12 sm:w-20 h-0.5 mx-1 ${s < step ? 'bg-green-400' : 'bg-gray-200'}`} />
                  )}
                </div>
              ))}
            </div>

            {/* 大会名表示 */}
            <div className="text-center mb-6 print:hidden">
              <h2 className="text-2xl font-bold text-gray-800">{currentTournament.name}</h2>
              <p className="text-gray-500 text-sm">{currentTournament.date}</p>
            </div>

            {/* ステップコンテンツ */}
            {step === 1 && (
              <ParticipantEditor
                tournamentName={currentTournament.name}
                tournamentDate={currentTournament.date}
                participants={currentTournament.participants}
                onUpdateInfo={updateTournamentInfo}
                onAddParticipant={addParticipant}
                onUpdateParticipant={updateParticipant}
                onRemoveParticipant={removeParticipant}
                onSetParticipants={setParticipants}
                onGenerateBracket={handleGenerateBracket}
              />
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div className="bg-white rounded-xl shadow p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-gray-700">組み合わせプレビュー</h2>
                    <div className="flex gap-2">
                      <button
                        onClick={shuffleBracket}
                        className="border border-gray-300 text-gray-600 hover:bg-gray-50 px-4 py-2 rounded-lg text-sm font-medium transition"
                      >
                        ランダムシャッフル
                      </button>
                      <button
                        onClick={() => setStep(1)}
                        className="border border-gray-300 text-gray-600 hover:bg-gray-50 px-4 py-2 rounded-lg text-sm font-medium transition"
                      >
                        ← 参加者を編集
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mb-4">参加者をドラッグ&ドロップで並び替えできます</p>
                  <BracketView
                    tournament={currentTournament}
                    interactive={true}
                    onSwapParticipants={swapParticipantsInBracket}
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={handleStartTournament}
                    className="bg-green-600 hover:bg-green-700 text-white font-bold px-8 py-3 rounded-xl text-base transition shadow"
                  >
                    試合開始 →
                  </button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                {winner && (
                  <div className="bg-yellow-50 border-2 border-yellow-400 rounded-xl p-4 flex items-center gap-4">
                    <span className="text-4xl">🏆</span>
                    <div>
                      <p className="text-yellow-700 font-bold text-lg">大会終了！</p>
                      <p className="text-gray-800 font-bold text-2xl">{winner.name} 優勝！</p>
                      {winner.affiliation && <p className="text-gray-500 text-sm">{winner.affiliation}</p>}
                    </div>
                  </div>
                )}
                <div className="bg-white rounded-xl shadow p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-gray-700">トーナメント表</h2>
                    <button
                      onClick={() => { setStep(4); setTimeout(() => window.print(), 100); }}
                      className="bg-gray-700 hover:bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
                    >
                      印刷
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mb-4">試合枠をクリックして結果を入力してください</p>
                  <BracketView
                    tournament={currentTournament}
                    interactive={true}
                    onRecordResult={recordMatchResult}
                  />
                </div>
              </div>
            )}

            {step === 4 && (
              <div>
                <div className="flex justify-between items-center mb-4 print:hidden">
                  <button
                    onClick={() => setStep(3)}
                    className="border border-gray-300 text-gray-600 hover:bg-gray-50 px-4 py-2 rounded-lg text-sm transition"
                  >
                    ← 試合進行に戻る
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="bg-gray-700 hover:bg-gray-800 text-white px-6 py-2 rounded-lg text-sm font-medium transition"
                  >
                    印刷する
                  </button>
                </div>
                <div className="bg-white rounded-xl shadow">
                  <PrintView tournament={currentTournament} />
                </div>
              </div>
            )}

            {/* 別大会に切り替え */}
            {appState.tournaments.length > 1 && (
              <div className="mt-8 pt-6 border-t border-gray-200 print:hidden">
                <p className="text-sm text-gray-500 mb-2">他の大会:</p>
                <div className="flex flex-wrap gap-2">
                  {appState.tournaments.filter(t => t.id !== currentTournament.id).map(t => (
                    <button
                      key={t.id}
                      onClick={() => { selectTournament(t.id); setStep(t.status === 'active' || t.status === 'completed' ? 3 : 1); }}
                      className="text-sm text-blue-600 hover:underline border border-blue-200 rounded px-3 py-1 hover:bg-blue-50"
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
