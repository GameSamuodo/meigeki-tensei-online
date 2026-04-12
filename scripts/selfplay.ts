import {
  applyReposition,
  applySlide,
  createInitialGameState,
  getMovableIndices,
  getRepositionIndices,
  getTriangleBlockedIndices,
  type GameState,
  type Player,
  type WinReason,
} from '../src/game.ts';

type Outcome = GameState['winner'] | 'ABORTED';
type AiPolicy = 'random' | 'mcts';

type MatchResult = {
  outcome: Outcome;
  reasons: GameState['winReason'];
  plies: number;
};

type Stats = {
  games: number;
  aborted: number;
  soloWins: Record<Player, number>;
  dualWins: number;
  points: Record<Player, number>;
  reasonCounts: Record<Exclude<WinReason, null>, number>;
  averagePlies: number;
};

type MctsNode = {
  state: GameState;
  move: number | null;
  visits: number;
  value: number;
  untriedMoves: number[];
  children: MctsNode[];
};

const DEFAULT_GAMES = 100;
const DEFAULT_MAX_PLIES = 500;
const DEFAULT_MCTS_ITERATIONS = 150;
const EXPLORATION = Math.sqrt(2);

function randomChoice<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

function getLegalIndices(state: GameState) {
  if (state.winner) return [];

  if (state.reposition) {
    return getRepositionIndices(
      state.board,
      state.reposition.player,
      state.reposition.from,
    );
  }

  const blocked = getTriangleBlockedIndices(state.jumpEmpty);

  return getMovableIndices(state.board, state.turnRotation).filter(
    (index) => !blocked.includes(index) || index === state.turnStartEmpty,
  );
}

function applyMove(state: GameState, index: number) {
  return state.reposition
    ? applyReposition(state, index)
    : applySlide(state, index);
}

function getRootPlayer(state: GameState): Player {
  return state.reposition ? state.reposition.player : state.currentPlayer;
}

function getOutcomeScore(outcome: Outcome, rootPlayer: Player) {
  if (outcome === 'ABORTED') return 0.5;
  if (outcome === 'BW') return 0.5;
  if (outcome === rootPlayer) return 1;
  return 0;
}

function rollout(state: GameState, maxPlies: number, rootPlayer: Player) {
  let current = state;
  let remaining = maxPlies;

  while (!current.winner && remaining > 0) {
    const legalMoves = getLegalIndices(current);
    if (legalMoves.length === 0) {
      return 0.5;
    }

    const nextState = applyMove(current, randomChoice(legalMoves));
    if (!nextState) {
      return 0.5;
    }

    current = nextState;
    remaining -= 1;
  }

  return getOutcomeScore(current.winner ?? 'ABORTED', rootPlayer);
}

function selectChild(node: MctsNode) {
  let bestChild = node.children[0];
  let bestScore = -Infinity;

  for (const child of node.children) {
    const exploitation = child.value / child.visits;
    const exploration = EXPLORATION * Math.sqrt(Math.log(node.visits) / child.visits);
    const score = exploitation + exploration;

    if (score > bestScore) {
      bestScore = score;
      bestChild = child;
    }
  }

  return bestChild;
}

function chooseMctsMove(state: GameState, iterations: number, maxPlies: number) {
  const rootPlayer = getRootPlayer(state);
  const root: MctsNode = {
    state,
    move: null,
    visits: 0,
    value: 0,
    untriedMoves: getLegalIndices(state),
    children: [],
  };

  if (root.untriedMoves.length === 0) return null;
  if (root.untriedMoves.length === 1) return root.untriedMoves[0];

  for (let i = 0; i < iterations; i += 1) {
    const path = [root];
    let node = root;

    while (node.untriedMoves.length === 0 && node.children.length > 0) {
      node = selectChild(node);
      path.push(node);
    }

    if (node.untriedMoves.length > 0) {
      const move = randomChoice(node.untriedMoves);
      node.untriedMoves = node.untriedMoves.filter((candidate) => candidate !== move);
      const nextState = applyMove(node.state, move);

      if (!nextState) {
        continue;
      }

      const child: MctsNode = {
        state: nextState,
        move,
        visits: 0,
        value: 0,
        untriedMoves: getLegalIndices(nextState),
        children: [],
      };
      node.children.push(child);
      node = child;
      path.push(node);
    }

    const score = rollout(node.state, maxPlies, rootPlayer);

    for (const visitedNode of path) {
      visitedNode.visits += 1;
      visitedNode.value += score;
    }
  }

  const bestChild = root.children.reduce((best, candidate) => {
    if (!best) return candidate;
    if (candidate.visits > best.visits) return candidate;
    if (candidate.visits === best.visits && candidate.value > best.value) return candidate;
    return best;
  }, null as MctsNode | null);

  return bestChild?.move ?? root.untriedMoves[0] ?? null;
}

function chooseMove(
  state: GameState,
  policy: AiPolicy,
  mctsIterations: number,
  maxPlies: number,
) {
  const legalMoves = getLegalIndices(state);
  if (legalMoves.length === 0) return null;

  if (policy === 'mcts') {
    const mctsMove = chooseMctsMove(state, mctsIterations, maxPlies);
    if (mctsMove !== null) return mctsMove;
  }

  return randomChoice(legalMoves);
}

function playOneGame(
  maxPlies: number,
  blackPolicy: AiPolicy,
  whitePolicy: AiPolicy,
  mctsIterations: number,
): MatchResult {
  let state = createInitialGameState();
  let plies = 0;

  while (!state.winner && plies < maxPlies) {
    const activePlayer = getRootPlayer(state);
    const policy = activePlayer === 'B' ? blackPolicy : whitePolicy;
    const index = chooseMove(state, policy, mctsIterations, maxPlies - plies);

    if (index === null) {
      return {
        outcome: 'ABORTED',
        reasons: state.winReason,
        plies,
      };
    }

    const nextState = applyMove(state, index);
    if (!nextState) {
      return {
        outcome: 'ABORTED',
        reasons: state.winReason,
        plies,
      };
    }

    state = nextState;
    plies += 1;
  }

  return {
    outcome: state.winner ?? 'ABORTED',
    reasons: state.winReason,
    plies,
  };
}

function createStats(): Stats {
  return {
    games: 0,
    aborted: 0,
    soloWins: {
      B: 0,
      W: 0,
    },
    dualWins: 0,
    points: {
      B: 0,
      W: 0,
    },
    reasonCounts: {
      terminal: 0,
      'mid-terminal': 0,
      score: 0,
      pilot: 0,
      bullets: 0,
      misTensei: 0,
    },
    averagePlies: 0,
  };
}

function addReasonCounts(
  stats: Stats,
  reasons: GameState['winReason'],
  players: Player[],
) {
  for (const player of players) {
    const reason = reasons[player];
    if (reason) {
      stats.reasonCounts[reason] += 1;
    }
  }
}

function runSimulation(
  games: number,
  maxPlies: number,
  blackPolicy: AiPolicy,
  whitePolicy: AiPolicy,
  mctsIterations: number,
) {
  const stats = createStats();
  let totalPlies = 0;

  for (let i = 0; i < games; i += 1) {
    const result = playOneGame(maxPlies, blackPolicy, whitePolicy, mctsIterations);
    stats.games += 1;
    totalPlies += result.plies;

    if (result.outcome === 'ABORTED') {
      stats.aborted += 1;
      continue;
    }

    if (result.outcome === 'BW') {
      stats.dualWins += 1;
      stats.points.B += 0.5;
      stats.points.W += 0.5;
      addReasonCounts(stats, result.reasons, ['B', 'W']);
      continue;
    }

    if (result.outcome === 'B' || result.outcome === 'W') {
      stats.soloWins[result.outcome] += 1;
      stats.points[result.outcome] += 1;
      addReasonCounts(stats, result.reasons, [result.outcome]);
    }
  }

  stats.averagePlies = stats.games > 0 ? totalPlies / stats.games : 0;
  return stats;
}

function formatPercent(value: number, total: number) {
  if (total === 0) return '0.00%';
  return `${((value / total) * 100).toFixed(2)}%`;
}

function printStats(stats: Stats) {
  console.log(`Games: ${stats.games}`);
  console.log(`Aborted: ${stats.aborted} (${formatPercent(stats.aborted, stats.games)})`);
  console.log(`Average plies: ${stats.averagePlies.toFixed(2)}`);
  console.log('');
  console.log('Outcomes');
  console.log(
    `Black solo wins: ${stats.soloWins.B} (${formatPercent(stats.soloWins.B, stats.games)})`,
  );
  console.log(
    `White solo wins: ${stats.soloWins.W} (${formatPercent(stats.soloWins.W, stats.games)})`,
  );
  console.log(`Dual wins: ${stats.dualWins} (${formatPercent(stats.dualWins, stats.games)})`);
  console.log('');
  console.log('Match points');
  console.log(
    `Black points: ${stats.points.B.toFixed(1)} (${formatPercent(stats.points.B, stats.games)})`,
  );
  console.log(
    `White points: ${stats.points.W.toFixed(1)} (${formatPercent(stats.points.W, stats.games)})`,
  );
  console.log('');
  console.log('Win reason distribution');
  for (const [reason, count] of Object.entries(stats.reasonCounts)) {
    console.log(`${reason}: ${count}`);
  }
}

function parsePolicy(value: string | undefined): AiPolicy {
  return value === 'mcts' ? 'mcts' : 'random';
}

const gamesArg = Number(process.argv[2] ?? DEFAULT_GAMES);
const maxPliesArg = Number(process.argv[3] ?? DEFAULT_MAX_PLIES);
const blackPolicy = parsePolicy(process.argv[4]);
const whitePolicy = parsePolicy(process.argv[5] ?? process.argv[4]);
const iterationsArg = Number(process.argv[6] ?? DEFAULT_MCTS_ITERATIONS);
const games = Number.isFinite(gamesArg) && gamesArg > 0 ? Math.floor(gamesArg) : DEFAULT_GAMES;
const maxPlies =
  Number.isFinite(maxPliesArg) && maxPliesArg > 0
    ? Math.floor(maxPliesArg)
    : DEFAULT_MAX_PLIES;
const mctsIterations =
  Number.isFinite(iterationsArg) && iterationsArg > 0
    ? Math.floor(iterationsArg)
    : DEFAULT_MCTS_ITERATIONS;

console.log(
  `Running ${games} self-play games (max ${maxPlies} plies, B=${blackPolicy}, W=${whitePolicy}, MCTS=${mctsIterations})...`,
);
console.log('');
printStats(runSimulation(games, maxPlies, blackPolicy, whitePolicy, mctsIterations));
