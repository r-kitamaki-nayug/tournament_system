import { Tournament } from '../types';
import BracketView from './BracketView';

interface Props {
  tournament: Tournament;
}

export default function PrintView({ tournament }: Props) {
  const today = new Date().toLocaleDateString('ja-JP', {
    year: 'numeric', month: 'long', day: 'numeric'
  });

  return (
    <div className="print-area p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">{tournament.name}</h1>
        <p className="text-gray-600 mt-1">
          開催日: {tournament.date} &nbsp;／&nbsp; 印刷日時: {today}
        </p>
        <p className="text-gray-500 text-sm">参加者: {tournament.participants.length}名</p>
      </div>
      <BracketView tournament={tournament} interactive={false} />
    </div>
  );
}
