export interface Participant {
  id: string;
  name: string;
  affiliation?: string;
  seed?: number;
}

export interface Match {
  id: string;
  round: number;
  position: number;
  participant1Id?: string;
  participant2Id?: string;
  winnerId?: string;
  score?: string;
  isBye?: boolean;
}

export interface Tournament {
  id: string;
  name: string;
  date: string;
  participants: Participant[];
  matches: Match[];
  status: 'draft' | 'active' | 'completed';
}

export interface AppState {
  tournaments: Tournament[];
  currentTournamentId?: string;
}

export type Step = 1 | 2 | 3 | 4;
