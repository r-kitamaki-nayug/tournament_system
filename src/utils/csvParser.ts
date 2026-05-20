import Papa from 'papaparse';
import { Participant } from '../types';

interface CsvRow {
  name?: string;
  affiliation?: string;
  [key: string]: string | undefined;
}

export function parseParticipantsCsv(file: File): Promise<Participant[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      // BOM付きUTF-8対応
      encoding: 'UTF-8',
      transformHeader: (header) => header.trim().replace(/^﻿/, ''),
      complete: (results) => {
        const errors: string[] = [];
        const participants: Participant[] = [];

        results.data.forEach((row, index) => {
          const name = row['name']?.trim() || row['氏名']?.trim() || row['名前']?.trim();
          if (!name) {
            errors.push(`行 ${index + 2}: 名前が空です`);
            return;
          }
          const affiliation = row['affiliation']?.trim() || row['所属']?.trim() || row['クラス']?.trim();
          participants.push({
            id: crypto.randomUUID(),
            name,
            affiliation: affiliation || undefined,
          });
        });

        if (participants.length === 0) {
          reject(new Error('有効な参加者データがありません。CSVのヘッダーに "name" または "氏名" 列が必要です。'));
          return;
        }

        if (errors.length > 0) {
          console.warn('CSV解析の警告:', errors);
        }

        resolve(participants);
      },
      error: (error) => {
        reject(new Error(`CSV解析エラー: ${error.message}`));
      },
    });
  });
}
