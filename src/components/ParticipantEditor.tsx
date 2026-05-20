import { useState, useRef } from 'react';
import { Participant } from '../types';
import { parseParticipantsCsv } from '../utils/csvParser';

interface Props {
  tournamentName: string;
  tournamentDate: string;
  participants: Participant[];
  onUpdateInfo: (name: string, date: string) => void;
  onAddParticipant: (p: Omit<Participant, 'id'>) => void;
  onUpdateParticipant: (id: string, data: Partial<Participant>) => void;
  onRemoveParticipant: (id: string) => void;
  onSetParticipants: (ps: Participant[]) => void;
  onGenerateBracket: () => void;
}

export default function ParticipantEditor({
  tournamentName,
  tournamentDate,
  participants,
  onUpdateInfo,
  onAddParticipant,
  onUpdateParticipant,
  onRemoveParticipant,
  onSetParticipants,
  onGenerateBracket,
}: Props) {
  const [name, setName] = useState(tournamentName);
  const [date, setDate] = useState(tournamentDate);
  const [newName, setNewName] = useState('');
  const [newAffiliation, setNewAffiliation] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editAffiliation, setEditAffiliation] = useState('');
  const [csvError, setCsvError] = useState('');
  const csvRef = useRef<HTMLInputElement>(null);

  const handleInfoBlur = () => {
    onUpdateInfo(name, date);
  };

  const handleAdd = () => {
    if (!newName.trim()) return;
    onAddParticipant({ name: newName.trim(), affiliation: newAffiliation.trim() || undefined });
    setNewName('');
    setNewAffiliation('');
  };

  const startEdit = (p: Participant) => {
    setEditingId(p.id);
    setEditName(p.name);
    setEditAffiliation(p.affiliation ?? '');
  };

  const saveEdit = (id: string) => {
    onUpdateParticipant(id, { name: editName.trim(), affiliation: editAffiliation.trim() || undefined });
    setEditingId(null);
  };

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvError('');
    try {
      const parsed = await parseParticipantsCsv(file);
      onSetParticipants([...participants, ...parsed]);
    } catch (err) {
      setCsvError((err as Error).message);
    }
    if (csvRef.current) csvRef.current.value = '';
  };

  return (
    <div className="space-y-6">
      {/* 大会情報 */}
      <div className="bg-white rounded-xl shadow p-5">
        <h2 className="text-lg font-bold text-gray-700 mb-4">大会情報</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">大会名</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              onBlur={handleInfoBlur}
              placeholder="例: 第1回校内テニス大会"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">開催日</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              onBlur={handleInfoBlur}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
        </div>
      </div>

      {/* CSV アップロード */}
      <div className="bg-white rounded-xl shadow p-5">
        <h2 className="text-lg font-bold text-gray-700 mb-3">CSVから一括登録</h2>
        <p className="text-sm text-gray-500 mb-3">
          ヘッダー行あり・UTF-8（BOM可）。列: <code className="bg-gray-100 px-1 rounded">name</code>（必須）、<code className="bg-gray-100 px-1 rounded">affiliation</code>（任意）
        </p>
        <div className="flex items-center gap-3">
          <label className="cursor-pointer bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium px-4 py-2 rounded-lg border border-blue-300 transition">
            CSVファイルを選択
            <input
              ref={csvRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleCsvUpload}
            />
          </label>
        </div>
        {csvError && <p className="mt-2 text-sm text-red-600">{csvError}</p>}
      </div>

      {/* 手動追加 */}
      <div className="bg-white rounded-xl shadow p-5">
        <h2 className="text-lg font-bold text-gray-700 mb-3">参加者を手動追加</h2>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">名前 <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              placeholder="田中太郎"
              className="border border-gray-300 rounded-lg px-3 py-2 w-40 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">所属</label>
            <input
              type="text"
              value={newAffiliation}
              onChange={e => setNewAffiliation(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              placeholder="3年A組"
              className="border border-gray-300 rounded-lg px-3 py-2 w-40 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <button
            onClick={handleAdd}
            disabled={!newName.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium px-5 py-2 rounded-lg transition"
          >
            追加
          </button>
        </div>
      </div>

      {/* 参加者一覧 */}
      <div className="bg-white rounded-xl shadow p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-700">
            参加者一覧
            <span className="ml-2 text-sm font-normal text-gray-500">（{participants.length}名）</span>
          </h2>
        </div>

        {participants.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-8">参加者がいません</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500">
                  <th className="text-left py-2 px-3 font-medium w-8">#</th>
                  <th className="text-left py-2 px-3 font-medium">名前</th>
                  <th className="text-left py-2 px-3 font-medium">所属</th>
                  <th className="text-center py-2 px-3 font-medium w-20">シード</th>
                  <th className="text-right py-2 px-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {participants.map((p, i) => (
                  <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 px-3 text-gray-400">{i + 1}</td>
                    {editingId === p.id ? (
                      <>
                        <td className="py-1 px-3">
                          <input
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                            className="border border-blue-400 rounded px-2 py-1 w-full focus:outline-none"
                          />
                        </td>
                        <td className="py-1 px-3">
                          <input
                            value={editAffiliation}
                            onChange={e => setEditAffiliation(e.target.value)}
                            className="border border-blue-400 rounded px-2 py-1 w-full focus:outline-none"
                          />
                        </td>
                        <td className="py-1 px-3 text-center">
                          <SeedInput participantId={p.id} seed={p.seed} onUpdate={onUpdateParticipant} />
                        </td>
                        <td className="py-1 px-3 text-right space-x-2">
                          <button
                            onClick={() => saveEdit(p.id)}
                            className="text-blue-600 hover:underline font-medium"
                          >保存</button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="text-gray-400 hover:underline"
                          >キャンセル</button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="py-2 px-3 font-medium text-gray-800">{p.name}</td>
                        <td className="py-2 px-3 text-gray-500">{p.affiliation ?? '-'}</td>
                        <td className="py-1 px-3 text-center">
                          <SeedInput participantId={p.id} seed={p.seed} onUpdate={onUpdateParticipant} />
                        </td>
                        <td className="py-2 px-3 text-right space-x-2">
                          <button
                            onClick={() => startEdit(p)}
                            className="text-blue-600 hover:underline text-sm"
                          >編集</button>
                          <button
                            onClick={() => onRemoveParticipant(p.id)}
                            className="text-red-500 hover:underline text-sm"
                          >削除</button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 生成ボタン */}
      <div className="flex justify-end">
        <button
          onClick={onGenerateBracket}
          disabled={participants.length < 2}
          className="bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold px-8 py-3 rounded-xl text-base transition shadow"
        >
          トーナメント表を生成 →
        </button>
      </div>
      {participants.length < 2 && (
        <p className="text-sm text-red-500 text-right">2名以上の参加者が必要です</p>
      )}
    </div>
  );
}

interface SeedInputProps {
  participantId: string;
  seed: number | undefined;
  onUpdate: (id: string, data: Partial<import('../types').Participant>) => void;
}

function SeedInput({ participantId, seed, onUpdate }: SeedInputProps) {
  return (
    <input
      type="number"
      min={1}
      value={seed ?? ''}
      onChange={e => onUpdate(participantId, { seed: e.target.value ? Number(e.target.value) : undefined })}
      placeholder="－"
      className="w-14 border border-gray-200 rounded px-1 py-1 text-center text-sm focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 hover:border-gray-400 transition"
    />
  );
}
