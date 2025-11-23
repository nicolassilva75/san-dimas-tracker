'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

type Team = 'A' | 'B';

type Player = {
  id: string;
  name: string;
  handicap: number;
  team: Team;
};

type MatchConfig = {
  id: number;
  label: string;
  players: Player[]; // [A1, A2, B1, B2]
};

type HoleMeta = {
  number: number;
  par: number;
  handicap: number; // 1–18, 1 = hardest
};

// San Dimas – White tees (Men)
const FRONT_HOLES: HoleMeta[] = [
  { number: 1, par: 4, handicap: 9 },
  { number: 2, par: 3, handicap: 17 },
  { number: 3, par: 5, handicap: 5 },
  { number: 4, par: 4, handicap: 1 },
  { number: 5, par: 3, handicap: 3 },
  { number: 6, par: 5, handicap: 15 },
  { number: 7, par: 3, handicap: 7 },
  { number: 8, par: 4, handicap: 11 },
  { number: 9, par: 5, handicap: 13 },
];

const BACK_HOLES: HoleMeta[] = [
  { number: 10, par: 3, handicap: 16 },
  { number: 11, par: 4, handicap: 8 },
  { number: 12, par: 5, handicap: 14 },
  { number: 13, par: 4, handicap: 6 },
  { number: 14, par: 4, handicap: 2 },
  { number: 15, par: 4, handicap: 10 },
  { number: 16, par: 3, handicap: 12 },
  { number: 17, par: 5, handicap: 18 },
  { number: 18, par: 4, handicap: 4 },
];

// 5 matches from your spreadsheet
const MATCHES: MatchConfig[] = [
  {
    id: 1,
    label: 'Group 1',
    players: [
      { id: 'm1-p1', name: 'Javier Tiscareno', handicap: 31.0, team: 'A' },
      { id: 'm1-p2', name: 'Kenny Wong', handicap: 14.0, team: 'A' },
      { id: 'm1-p3', name: 'Nick Silva', handicap: 2.2, team: 'B' },
      { id: 'm1-p4', name: 'Brandon Chu', handicap: 46.0, team: 'B' },
    ],
  },
  {
    id: 2,
    label: 'Group 2',
    players: [
      { id: 'm2-p1', name: 'Justin Tanaka', handicap: 9.9, team: 'A' },
      { id: 'm2-p2', name: 'Jon Huynh', handicap: 13.0, team: 'A' },
      { id: 'm2-p3', name: 'Zachary Soohoo', handicap: 16.0, team: 'B' },
      { id: 'm2-p4', name: 'Justin Cheng', handicap: 14.0, team: 'B' },
    ],
  },
  {
    id: 3,
    label: 'Group 3',
    players: [
      { id: 'm3-p1', name: 'Greg Lee', handicap: 8.0, team: 'A' },
      { id: 'm3-p2', name: 'JR Tuason', handicap: 20.0, team: 'A' },
      { id: 'm3-p3', name: 'Jeff Tuason', handicap: 8.2, team: 'B' },
      { id: 'm3-p4', name: 'Korey Fukui', handicap: 23.0, team: 'B' },
    ],
  },
  {
    id: 4,
    label: 'Group 4',
    players: [
      { id: 'm4-p1', name: 'Kyle Lee', handicap: 11.3, team: 'A' },
      { id: 'm4-p2', name: 'Michael Abe', handicap: 16.4, team: 'A' },
      { id: 'm4-p3', name: 'Raymond Tuason', handicap: 19.0, team: 'B' },
      { id: 'm4-p4', name: 'Brian Tuason', handicap: 20.0, team: 'B' },
    ],
  },
  {
    id: 5,
    label: 'Group 5',
    players: [
      { id: 'm5-p1', name: 'Mike Yamada', handicap: 12.0, team: 'A' },
      { id: 'm5-p2', name: 'Kyle Hata', handicap: 18.0, team: 'A' },
      { id: 'm5-p3', name: 'Ryan Shimizu', handicap: 15.0, team: 'B' },
      { id: 'm5-p4', name: 'Gerame Wong', handicap: 17.0, team: 'B' },
    ],
  },
];

// ---------- Helpers ----------

function strokesForHole(playerHcp: number, holeHcp: number): number {
  if (!playerHcp || !holeHcp) return 0;
  const base = Math.floor(playerHcp / 18);
  const extra = playerHcp % 18;
  return base + (holeHcp <= extra ? 1 : 0);
}

function toNumber(value: string | number | null | undefined): number | null {
  if (value === '' || value === null || value === undefined) return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function bestNet(...nets: (number | null)[]): number | null {
  const valid = nets.filter((n): n is number => n !== null && Number.isFinite(n));
  if (!valid.length) return null;
  return Math.min(...valid);
}

type HoleResult = Team | 'AS' | null;

function holeResult(aNet: number | null, bNet: number | null): HoleResult {
  if (aNet === null || bNet === null) return null;
  if (aNet < bNet) return 'A';
  if (bNet < aNet) return 'B';
  return 'AS';
}

function statusFromResults(results: HoleResult[]): string {
  let diff = 0;
  let holesPlayed = 0;
  for (const r of results) {
    if (!r) continue;
    if (r === 'AS') {
      holesPlayed++;
      continue;
    }
    holesPlayed++;
    if (r === 'A') diff++;
    if (r === 'B') diff--;
  }
  if (holesPlayed === 0) return 'All square';
  if (diff === 0) return `All square thru ${holesPlayed}`;
  if (diff > 0) return `Team A up ${diff} thru ${holesPlayed}`;
  return `Team B up ${-diff} thru ${holesPlayed}`;
}

function avgTeamHandicap(p1: Player, p2: Player): number {
  return Math.round((p1.handicap + p2.handicap) / 2);
}

function ninePoints(results: HoleResult[]): {
  a: number;
  b: number;
  result: HoleResult;
} {
  let diff = 0;
  let holesPlayed = 0;
  for (const r of results) {
    if (!r) continue;
    if (r === 'AS') {
      holesPlayed++;
      continue;
    }
    holesPlayed++;
    if (r === 'A') diff++;
    if (r === 'B') diff--;
  }
  if (holesPlayed === 0) return { a: 0, b: 0, result: null };
  if (diff > 0) return { a: 1, b: 0, result: 'A' };
  if (diff < 0) return { a: 0, b: 1, result: 'B' };
  return { a: 0.5, b: 0.5, result: 'AS' };
}

// ---------- State types ----------

type FrontHoleState = {
  gross: Record<string, string>; // playerId -> gross
};

type BackHoleState = {
  grossTeamA: string;
  grossTeamB: string;
};

type MatchState = {
  front: FrontHoleState[];
  back: BackHoleState[];
};

type ScoresState = Record<number, MatchState>;

function createEmptyScores(): ScoresState {
  const scores: ScoresState = {};
  for (const match of MATCHES) {
    scores[match.id] = {
      front: FRONT_HOLES.map(() => ({ gross: {} })),
      back: BACK_HOLES.map(() => ({ grossTeamA: '', grossTeamB: '' })),
    };
  }
  return scores;
}

// ---------- Component ----------

export default function Page() {
  const [selectedMatchId, setSelectedMatchId] = useState<number>(1);
  const [scores, setScores] = useState<ScoresState>(createEmptyScores);

  // Initial load + realtime subscription
  // Initial load + realtime subscription
  useEffect(() => {
    const loadInitial = async () => {
      const [frontRes, backRes] = await Promise.all([
        supabase.from('front_scores').select('*'),
        supabase.from('back_scores').select('*'),
      ]);

      let next = createEmptyScores();

      if (!frontRes.error && frontRes.data) {
        for (const row of frontRes.data as any[]) {
          const { match_id, hole_number, player_id, gross } = row;
          if (!next[match_id]) continue;
          const holeIndex = FRONT_HOLES.findIndex(
            (h) => h.number === hole_number
          );
          if (holeIndex === -1) continue;
          next[match_id].front[holeIndex].gross[player_id] =
            gross === null || gross === undefined ? '' : String(gross);
        }
      }

      if (!backRes.error && backRes.data) {
        for (const row of backRes.data as any[]) {
          const { match_id, hole_number, team, gross } = row;
          if (!next[match_id]) continue;
          const holeIndex = BACK_HOLES.findIndex(
            (h) => h.number === hole_number
          );
          if (holeIndex === -1) continue;
          if (team === 'A') {
            next[match_id].back[holeIndex].grossTeamA =
              gross === null || gross === undefined ? '' : String(gross);
          } else if (team === 'B') {
            next[match_id].back[holeIndex].grossTeamB =
              gross === null || gross === undefined ? '' : String(gross);
          }
        }
      }

      setScores(next);
    };

    loadInitial();

    const channel = supabase
      .channel('scores-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'front_scores' },
        (payload) => {
          const row: any = payload.new;
          const { match_id, hole_number, player_id, gross } = row;
          setScores((prev) => {
            if (!prev[match_id]) return prev;
            const holeIndex = FRONT_HOLES.findIndex(
              (h) => h.number === hole_number
            );
            if (holeIndex === -1) return prev;
            const next = { ...prev };
            const ms = { ...next[match_id] };
            const front = ms.front.map((h, i) =>
              i === holeIndex
                ? {
                    gross: {
                      ...h.gross,
                      [player_id]:
                        gross === null || gross === undefined
                          ? ''
                          : String(gross),
                    },
                  }
                : h
            );
            ms.front = front;
            next[match_id] = ms;
            return next;
          });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'back_scores' },
        (payload) => {
          const row: any = payload.new;
          const { match_id, hole_number, team, gross } = row;
          setScores((prev) => {
            if (!prev[match_id]) return prev;
            const holeIndex = BACK_HOLES.findIndex(
              (h) => h.number === hole_number
            );
            if (holeIndex === -1) return prev;
            const next = { ...prev };
            const ms = { ...next[match_id] };
            const back = ms.back.map((h, i) => {
              if (i !== holeIndex) return h;
              if (team === 'A') {
                return {
                  ...h,
                  grossTeamA:
                    gross === null || gross === undefined ? '' : String(gross),
                };
              }
              if (team === 'B') {
                return {
                  ...h,
                  grossTeamB:
                    gross === null || gross === undefined ? '' : String(gross),
                };
              }
              return h;
            });
            ms.back = back;
            next[match_id] = ms;
            return next;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);


  const match = MATCHES.find((m) => m.id === selectedMatchId)!;
  const [a1, a2, b1, b2] = match.players;
  const matchState = scores[selectedMatchId];

  const teamAHcp = avgTeamHandicap(a1, a2);
  const teamBHcp = avgTeamHandicap(b1, b2);
  const higherTeam: Team | null =
    teamAHcp > teamBHcp ? 'A' : teamBHcp > teamAHcp ? 'B' : null;
  const strokeDiff = Math.abs(teamAHcp - teamBHcp);

  // ------- Handlers that also upsert to Supabase -------

  const handleFrontChange = async (
    holeIndex: number,
    playerId: string,
    value: string
  ) => {
    const holeNumber = FRONT_HOLES[holeIndex].number;
    const matchId = selectedMatchId;

    setScores((prev) => {
      const next = { ...prev };
      const ms = { ...next[matchId] };
      const front = ms.front.map((h, i) =>
        i === holeIndex
          ? { gross: { ...h.gross, [playerId]: value } }
          : h
      );
      ms.front = front;
      next[matchId] = ms;
      return next;
    });

        const grossNum = value === '' ? null : Number(value);

  const res = await supabase.from('front_scores').upsert(
    {
      match_id: matchId,
      hole_number: holeNumber,
      player_id: playerId,
      gross: isNaN(grossNum as number) ? null : grossNum,
    },
    { onConflict: 'match_id,hole_number,player_id' }
  );

  console.log('front_scores upsert result', res);
  if (res.error) {
    console.error('front_scores upsert error', res.error);
  }
};


  const handleBackChange = async (
  holeIndex: number,
  team: Team,
  value: string
) => {
  const holeNumber = BACK_HOLES[holeIndex].number;
  const matchId = selectedMatchId;

  setScores((prev) => {
    const next = { ...prev };
    const ms = { ...next[matchId] };
    const back = ms.back.map((h, i) => {
      if (i !== holeIndex) return h;
      return team === 'A'
        ? { ...h, grossTeamA: value }
        : { ...h, grossTeamB: value };
    });
    ms.back = back;
    next[matchId] = ms;
    return next;
  });

    const grossNum = value === '' ? null : Number(value);

  const res = await supabase.from('back_scores').upsert(
    {
      match_id: matchId,
      hole_number: holeNumber,
      team,
      gross: isNaN(grossNum as number) ? null : grossNum,
    },
    { onConflict: 'match_id,hole_number,team' }
  );

  console.log('back_scores upsert result', res);
  if (res.error) {
    console.error('back_scores upsert error', res.error);
  }
};


  // ------- Results for current match (status headers) -------

  const frontResults: HoleResult[] = FRONT_HOLES.map((hole, idx) => {
    const holeState = matchState.front[idx];
    const gA1 = toNumber(holeState.gross[a1.id]);
    const gA2 = toNumber(holeState.gross[a2.id]);
    const gB1 = toNumber(holeState.gross[b1.id]);
    const gB2 = toNumber(holeState.gross[b2.id]);

    const nA1 =
      gA1 === null ? null : gA1 - strokesForHole(a1.handicap, hole.handicap);
    const nA2 =
      gA2 === null ? null : gA2 - strokesForHole(a2.handicap, hole.handicap);
    const nB1 =
      gB1 === null ? null : gB1 - strokesForHole(b1.handicap, hole.handicap);
    const nB2 =
      gB2 === null ? null : gB2 - strokesForHole(b2.handicap, hole.handicap);

    const bestA = bestNet(nA1, nA2);
    const bestB = bestNet(nB1, nB2);
    return holeResult(bestA, bestB);
  });

  const backResults: HoleResult[] = BACK_HOLES.map((hole, idx) => {
    const holeState = matchState.back[idx];
    const gA = toNumber(holeState.grossTeamA);
    const gB = toNumber(holeState.grossTeamB);
    if (gA === null || gB === null) return null;

    const strokesThisHole =
      higherTeam && strokeDiff
        ? strokesForHole(strokeDiff, hole.handicap)
        : 0;

    const nA = higherTeam === 'A' ? gA - strokesThisHole : gA;
    const nB = higherTeam === 'B' ? gB - strokesThisHole : gB;

    return holeResult(nA, nB);
  });

  // ------- Event-wide leaderboard (computed from 'scores') -------

    const leaderboardRows = MATCHES.map((m) => {
    const [ma1, ma2, mb1, mb2] = m.players;
    const ms = scores[m.id];

    // Front 9 results for this match
    const frontRes: HoleResult[] = FRONT_HOLES.map((hole, idx) => {
      const hs = ms.front[idx];
      const gA1 = toNumber(hs.gross[ma1.id]);
      const gA2 = toNumber(hs.gross[ma2.id]);
      const gB1 = toNumber(hs.gross[mb1.id]);
      const gB2 = toNumber(hs.gross[mb2.id]);

      const nA1 =
        gA1 === null ? null : gA1 - strokesForHole(ma1.handicap, hole.handicap);
      const nA2 =
        gA2 === null ? null : gA2 - strokesForHole(ma2.handicap, hole.handicap);
      const nB1 =
        gB1 === null ? null : gB1 - strokesForHole(mb1.handicap, hole.handicap);
      const nB2 =
        gB2 === null ? null : gB2 - strokesForHole(mb2.handicap, hole.handicap);

      const bestA = bestNet(nA1, nA2);
      const bestB = bestNet(nB1, nB2);
      return holeResult(bestA, bestB);
    });

    // Back 9 results for this match
    const mtAHcp = avgTeamHandicap(ma1, ma2);
    const mtBHcp = avgTeamHandicap(mb1, mb2);
    const mtHigherTeam: Team | null =
      mtAHcp > mtBHcp ? 'A' : mtBHcp > mtAHcp ? 'B' : null;
    const mtStrokeDiff = Math.abs(mtAHcp - mtBHcp);

    const backRes: HoleResult[] = BACK_HOLES.map((hole, idx) => {
      const hs = ms.back[idx];
      const gA = toNumber(hs.grossTeamA);
      const gB = toNumber(hs.grossTeamB);
      if (gA === null || gB === null) return null;

      const strokesThisHole =
        mtHigherTeam && mtStrokeDiff
          ? strokesForHole(mtStrokeDiff, hole.handicap)
          : 0;

      const nA = mtHigherTeam === 'A' ? gA - strokesThisHole : gA;
      const nB = mtHigherTeam === 'B' ? gB - strokesThisHole : gB;

      return holeResult(nA, nB);
    });

    const frontSummary = ninePoints(frontRes);
    const backSummary = ninePoints(backRes);
    const totalA = frontSummary.a + backSummary.a;
    const totalB = frontSummary.b + backSummary.b;

    const frontStatus = statusFromResults(frontRes);
    const backStatus = statusFromResults(backRes);

    return {
      matchId: m.id,
      label: m.label,
      teamAName: `${ma1.name} / ${ma2.name}`,
      teamBName: `${mb1.name} / ${mb2.name}`,
      frontSummary,
      backSummary,
      frontStatus,
      backStatus,
      totalA,
      totalB,
    };
  });


  const eventTotals = leaderboardRows.reduce(
    (acc, row) => {
      acc.a += row.totalA;
      acc.b += row.totalB;
      return acc;
    },
    { a: 0, b: 0 }
  );

  // ---------- UI ----------
  const [a1p, a2p, b1p, b2p] = [a1, a2, b1, b2];

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 px-3 py-4">
      <div className="mx-auto max-w-4xl space-y-4">
        {/* Header / match selector */}
        <header className="space-y-2">
          <h1 className="text-xl font-semibold text-center">
            San Dimas Canyon – Match Tracker
          </h1>
          <p className="text-xs text-center text-slate-300">
            Front 9: 2-Man Net Best Ball · Back 9: 2-Man Alternate Shot
          </p>

          <div className="flex gap-2 overflow-x-auto py-1">
            {MATCHES.map((m) => (
              <button
                key={m.id}
                onClick={() => setSelectedMatchId(m.id)}
                className={`whitespace-nowrap rounded-full px-3 py-1 text-xs border ${
                  m.id === selectedMatchId
                    ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                    : 'bg-slate-800 border-slate-600'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Team info + tee order */}
          <div className="rounded-xl bg-slate-900 border border-slate-700 p-3 text-xs space-y-1">
            <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
              <div>
                <div className="font-semibold">Team A</div>
                <div>
                  {a1p.name} ({a1p.handicap})
                </div>
                <div>
                  {a2p.name} ({a2p.handicap})
                </div>
              </div>
              <div>
                <div className="font-semibold">Team B</div>
                <div>
                  {b1p.name} ({b1p.handicap})
                </div>
                <div>
                  {b2p.name} ({b2p.handicap})
                </div>
              </div>
            </div>
            <div className="pt-1 border-t border-slate-700 mt-1">
              <div className="text-[11px] text-slate-300">
                Back 9 tee order – Alternate Shot:
                <br />
                Team A: Even holes{' '}
                {a1p.handicap <= a2p.handicap ? a1p.name : a2p.name} · Odd holes{' '}
                {a1p.handicap <= a2p.handicap ? a2p.name : a1p.name}
                <br />
                Team B: Even holes{' '}
                {b1p.handicap <= b2p.handicap ? b1p.name : b2p.name} · Odd holes{' '}
                {b1p.handicap <= b2p.handicap ? b2p.name : b1p.name}
                <br />
                Team Hcp (Alt): A {teamAHcp} · B {teamBHcp}{' '}
                {higherTeam && strokeDiff
                  ? `→ ${strokeDiff} strokes to Team ${higherTeam}`
                  : ''}
              </div>
            </div>
          </div>
        </header>

        {/* FRONT 9 */}
        <section className="space-y-2">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold">
              Front 9 – 2-Man Net Best Ball
            </h2>
            <span className="text-[11px] text-slate-300">
              Status: {statusFromResults(frontResults)}
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900">
            <table className="min-w-full text-[11px]">
              <thead className="bg-slate-800">
                <tr>
                  <th className="px-1 py-1 text-left">Hole</th>
                  <th className="px-1 py-1 text-center">Par</th>
                  <th className="px-1 py-1 text-center">Hcp</th>
                  <th className="px-1 py-1 text-center">
                    {a1p.name}
                    <br />
                    Gross
                  </th>
                  <th className="px-1 py-1 text-center">Net</th>
                  <th className="px-1 py-1 text-center">
                    {a2p.name}
                    <br />
                    Gross
                  </th>
                  <th className="px-1 py-1 text-center">Net</th>
                  <th className="px-1 py-1 text-center">A Best</th>
                  <th className="px-1 py-1 text-center">
                    {b1p.name}
                    <br />
                    Gross
                  </th>
                  <th className="px-1 py-1 text-center">Net</th>
                  <th className="px-1 py-1 text-center">
                    {b2p.name}
                    <br />
                    Gross
                  </th>
                  <th className="px-1 py-1 text-center">Net</th>
                  <th className="px-1 py-1 text-center">B Best</th>
                  <th className="px-1 py-1 text-center">Winner</th>
                </tr>
              </thead>
              <tbody>
                {FRONT_HOLES.map((hole, idx) => {
                  const hs = matchState.front[idx];
                  const gA1Str = hs.gross[a1p.id] ?? '';
                  const gA2Str = hs.gross[a2p.id] ?? '';
                  const gB1Str = hs.gross[b1p.id] ?? '';
                  const gB2Str = hs.gross[b2p.id] ?? '';

                  const gA1 = toNumber(gA1Str);
                  const gA2 = toNumber(gA2Str);
                  const gB1 = toNumber(gB1Str);
                  const gB2 = toNumber(gB2Str);

                  const nA1 =
                    gA1 === null
                      ? null
                      : gA1 - strokesForHole(a1p.handicap, hole.handicap);
                  const nA2 =
                    gA2 === null
                      ? null
                      : gA2 - strokesForHole(a2p.handicap, hole.handicap);
                  const nB1 =
                    gB1 === null
                      ? null
                      : gB1 - strokesForHole(b1p.handicap, hole.handicap);
                  const nB2 =
                    gB2 === null
                      ? null
                      : gB2 - strokesForHole(b2p.handicap, hole.handicap);

                  const bestA = bestNet(nA1, nA2);
                  const bestB = bestNet(nB1, nB2);
                  const r = holeResult(bestA, bestB);
                  const winnerLabel =
                    r === 'A' ? 'A' : r === 'B' ? 'B' : r === 'AS' ? 'AS' : '';

                  return (
                    <tr
                      key={hole.number}
                      className="odd:bg-slate-900 even:bg-slate-950"
                    >
                      <td className="px-1 py-1">{hole.number}</td>
                      <td className="px-1 py-1 text-center">{hole.par}</td>
                      <td className="px-1 py-1 text-center">
                        {hole.handicap}
                      </td>

                      {/* A1 */}
                      <td className="px-1 py-1 text-center">
                        <input
                          inputMode="numeric"
                          className="w-12 rounded bg-slate-800 px-1 py-0.5 text-center"
                          value={gA1Str}
                          onChange={(e) =>
                            handleFrontChange(idx, a1p.id, e.target.value)
                          }
                        />
                      </td>
                      <td className="px-1 py-1 text-center">
                        {nA1 !== null ? nA1 : ''}
                      </td>

                      {/* A2 */}
                      <td className="px-1 py-1 text-center">
                        <input
                          inputMode="numeric"
                          className="w-12 rounded bg-slate-800 px-1 py-0.5 text-center"
                          value={gA2Str}
                          onChange={(e) =>
                            handleFrontChange(idx, a2p.id, e.target.value)
                          }
                        />
                      </td>
                      <td className="px-1 py-1 text-center">
                        {nA2 !== null ? nA2 : ''}
                      </td>

                      {/* A Best */}
                      <td className="px-1 py-1 text-center font-semibold">
                        {bestA !== null ? bestA : ''}
                      </td>

                      {/* B1 */}
                      <td className="px-1 py-1 text-center">
                        <input
                          inputMode="numeric"
                          className="w-12 rounded bg-slate-800 px-1 py-0.5 text-center"
                          value={gB1Str}
                          onChange={(e) =>
                            handleFrontChange(idx, b1p.id, e.target.value)
                          }
                        />
                      </td>
                      <td className="px-1 py-1 text-center">
                        {nB1 !== null ? nB1 : ''}
                      </td>

                      {/* B2 */}
                      <td className="px-1 py-1 text-center">
                        <input
                          inputMode="numeric"
                          className="w-12 rounded bg-slate-800 px-1 py-0.5 text-center"
                          value={gB2Str}
                          onChange={(e) =>
                            handleFrontChange(idx, b2p.id, e.target.value)
                          }
                        />
                      </td>
                      <td className="px-1 py-1 text-center">
                        {nB2 !== null ? nB2 : ''}
                      </td>

                      {/* B Best */}
                      <td className="px-1 py-1 text-center font-semibold">
                        {bestB !== null ? bestB : ''}
                      </td>

                      <td className="px-1 py-1 text-center font-semibold">
                        {winnerLabel}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* BACK 9 */}
        <section className="space-y-2">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold">
              Back 9 – Alternate Shot (team gross)
            </h2>
            <span className="text-[11px] text-slate-300">
              Status: {statusFromResults(backResults)}
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900">
            <table className="min-w-full text-[11px]">
              <thead className="bg-slate-800">
                <tr>
                  <th className="px-1 py-1 text-left">Hole</th>
                  <th className="px-1 py-1 text-center">Par</th>
                  <th className="px-1 py-1 text-center">Hcp</th>
                  <th className="px-1 py-1 text-center">Team A Gross</th>
                  <th className="px-1 py-1 text-center">Team A Net</th>
                  <th className="px-1 py-1 text-center">Team B Gross</th>
                  <th className="px-1 py-1 text-center">Team B Net</th>
                  <th className="px-1 py-1 text-center">Winner</th>
                </tr>
              </thead>
              <tbody>
                {BACK_HOLES.map((hole, idx) => {
                  const hs = matchState.back[idx];
                  const gAStr = hs.grossTeamA;
                  const gBStr = hs.grossTeamB;
                  const gA = toNumber(gAStr);
                  const gB = toNumber(gBStr);

                  const strokesThisHole =
                    higherTeam && strokeDiff
                      ? strokesForHole(strokeDiff, hole.handicap)
                      : 0;

                  const nA =
                    gA === null
                      ? null
                      : higherTeam === 'A'
                      ? gA - strokesThisHole
                      : gA;
                  const nB =
                    gB === null
                      ? null
                      : higherTeam === 'B'
                      ? gB - strokesThisHole
                      : gB;

                  const r = holeResult(nA, nB);
                  const winnerLabel =
                    r === 'A' ? 'A' : r === 'B' ? 'B' : r === 'AS' ? 'AS' : '';

                  return (
                    <tr
                      key={hole.number}
                      className="odd:bg-slate-900 even:bg-slate-950"
                    >
                      <td className="px-1 py-1">{hole.number}</td>
                      <td className="px-1 py-1 text-center">{hole.par}</td>
                      <td className="px-1 py-1 text-center">
                        {hole.handicap}
                      </td>

                      {/* Team A */}
                      <td className="px-1 py-1 text-center">
                        <input
                          inputMode="numeric"
                          className="w-14 rounded bg-slate-800 px-1 py-0.5 text-center"
                          value={gAStr}
                          onChange={(e) =>
                            handleBackChange(idx, 'A', e.target.value)
                          }
                        />
                      </td>
                      <td className="px-1 py-1 text-center">
                        {nA !== null ? nA : ''}
                      </td>

                      {/* Team B */}
                      <td className="px-1 py-1 text-center">
                        <input
                          inputMode="numeric"
                          className="w-14 rounded bg-slate-800 px-1 py-0.5 text-center"
                          value={gBStr}
                          onChange={(e) =>
                            handleBackChange(idx, 'B', e.target.value)
                          }
                        />
                      </td>
                      <td className="px-1 py-1 text-center">
                        {nB !== null ? nB : ''}
                      </td>

                      <td className="px-1 py-1 text-center font-semibold">
                        {winnerLabel}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* LIVE LEADERBOARD */}
        <section className="space-y-2 pb-6">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold">Event Leaderboard</h2>
            <span className="text-[11px] text-slate-300">
              Total Points – Team A: {eventTotals.a.toFixed(1)} · Team B:{' '}
              {eventTotals.b.toFixed(1)}
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900">
                        <table className="min-w-full text-[11px]">
              <thead className="bg-slate-800">
                <tr>
                  <th className="px-2 py-1 text-left">Match</th>
                  <th className="px-2 py-1 text-left">Team A</th>
                  <th className="px-2 py-1 text-left">Team B</th>
                  <th className="px-2 py-1 text-center">Front 9 Status</th>
                  <th className="px-2 py-1 text-center">Back 9 Status</th>
                  <th className="px-2 py-1 text-center">Total A</th>
                  <th className="px-2 py-1 text-center">Total B</th>
                </tr>
              </thead>
              <tbody>
                {leaderboardRows.map((row) => {
                  const aLeading = row.totalA > row.totalB;
                  const bLeading = row.totalB > row.totalA;

                  return (
                    <tr
                      key={row.matchId}
                      className="odd:bg-slate-900 even:bg-slate-950"
                    >
                      <td className="px-2 py-1">{row.label}</td>
                      <td className="px-2 py-1">{row.teamAName}</td>
                      <td className="px-2 py-1">{row.teamBName}</td>
                      <td className="px-2 py-1 text-center">
                        {row.frontStatus}
                      </td>
                      <td className="px-2 py-1 text-center">
                        {row.backStatus}
                      </td>
                      <td
                        className={`px-2 py-1 text-center ${
                          aLeading ? 'font-semibold text-emerald-400' : ''
                        }`}
                      >
                        {row.totalA ? row.totalA.toFixed(1) : ''}
                      </td>
                      <td
                        className={`px-2 py-1 text-center ${
                          bLeading ? 'font-semibold text-emerald-400' : ''
                        }`}
                      >
                        {row.totalB ? row.totalB.toFixed(1) : ''}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
