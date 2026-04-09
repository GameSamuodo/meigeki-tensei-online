export const SIZE = 7;
const PERIMETER_LENGTH = SIZE * 4 - 4;

export type CellType =
  | 'TARGET'
  | 'TARGET:B'
  | 'TARGET:W'
  | 'BP'
  | 'BPP'
  | 'WP'
  | 'WPP'
  | 'DEADEND'
  | 'TERM'
  | 'DEADTARGET'
  | 'DEADTARGET:B'
  | 'DEADTARGET:W'
  | 'DEAD:BP'
  | 'DEAD:WP';

export type Player = 'B' | 'W';
export type WinReason =
  | 'terminal'
  | 'mid-terminal'
  | 'score'
  | 'pilot'
  | 'bullets'
  | 'misTensei';

export type Cell = {
  type?: CellType;
  imageSrc?: string;
};

export type GameState = {
  board: Cell[];
  currentPlayer: Player;
  winner: 'B' | 'W' | 'BW' | null;
  winReason: Record<Player, WinReason | null>;
  winHighlightIndices: number[];
  midTerminal: {
    player: Player | null;
    highlightIndices: number[];
  };
  bulletsUsed: Record<Player, number>;
  score: Record<Player, number>;
  turnRotation: number;
  turnStartEmpty: number;
  jumpEmpty: Record<Player, number | null>;
  reposition: {
    player: Player;
    from: number;
    remainingPilots: number;
    endTurnAfterResolution: boolean;
  } | null;
};

function isAliveCellType(type?: CellType) {
  return (
    type === 'TERM' ||
    type === 'TARGET' ||
    type === 'TARGET:B' ||
    type === 'TARGET:W' ||
    type === 'BP' ||
    type === 'BPP' ||
    type === 'WP' ||
    type === 'WPP'
  );
}

function isDeadCellType(type?: CellType) {
  return (
    type === 'DEADTARGET' ||
    type === 'DEADTARGET:B' ||
    type === 'DEADTARGET:W' ||
    type === 'DEAD:BP' ||
    type === 'DEAD:WP'
  );
}

function getPilotType(player: Player): CellType {
  return player === 'B' ? 'BP' : 'WP';
}

function getDoublePilotType(player: Player): CellType {
  return player === 'B' ? 'BPP' : 'WPP';
}

function isPilotType(type: CellType | undefined, player: Player) {
  return type === getPilotType(player) || type === getDoublePilotType(player);
}

function getOwnedTargetType(player: Player): CellType {
  return player === 'B' ? 'TARGET:B' : 'TARGET:W';
}

function toDeadType(type?: CellType): CellType | undefined {
  if (type === 'TARGET') return 'DEADTARGET';
  if (type === 'TARGET:B') return 'DEADTARGET:B';
  if (type === 'TARGET:W') return 'DEADTARGET:W';
  if (type === 'BP') return 'DEAD:BP';
  if (type === 'BPP') return 'DEAD:BP';
  if (type === 'WP') return 'DEAD:WP';
  if (type === 'WPP') return 'DEAD:WP';
  return type;
}

function getDeadImageSrc(type: CellType | undefined, player: Player) {
  if (type === 'TARGET') {
    return player === 'B' ? '/deadtargetb.png' : '/deadtargetw.png';
  }

  if (type === 'TARGET:B' || type === 'BP' || type === 'BPP') {
    return player === 'B' ? '/deadbb.png' : '/deadbw.png';
  }

  if (type === 'TARGET:W' || type === 'WP' || type === 'WPP') {
    return player === 'B' ? '/deadwb.png' : '/deadww.png';
  }

  return undefined;
}

export function createInitialBoard(): Cell[] {
  const board: Cell[] = [];

  for (let i = 0; i < 8; i++) {
    board.push({ type: 'DEADEND' });
  }
  for (let i = 8; i < 10; i++) {
    board.push({ type: 'TARGET:W' });
  }
  board[10] = { type: 'WP' };
  for (let i = 11; i < 13; i++) {
    board.push({ type: 'TARGET' });
  }
  for (let i = 13; i < 15; i++) {
    board.push({ type: 'DEADEND' });
  }
  board[15] = { type: 'TARGET:W' };
  for (let i = 16; i < 20; i++) {
    board.push({ type: 'TARGET' });
  }
  for (let i = 20; i < 22; i++) {
    board.push({ type: 'DEADEND' });
  }
  board[22] = { type: 'WP' };
  board[23] = { type: 'TARGET' };
  board[24] = { type: 'TERM' };
  board[25] = { type: 'TARGET' };
  board[26] = { type: 'BP' };
  for (let i = 27; i < 29; i++) {
    board.push({ type: 'DEADEND' });
  }
  for (let i = 29; i < 33; i++) {
    board.push({ type: 'TARGET' });
  }
  board[33] = { type: 'TARGET:B' };
  for (let i = 34; i < 36; i++) {
    board.push({ type: 'DEADEND' });
  }
  for (let i = 36; i < 38; i++) {
    board.push({ type: 'TARGET' });
  }
  board[38] = { type: 'BP' };
  for (let i = 39; i < 41; i++) {
    board.push({ type: 'TARGET:B' });
  }
  for (let i = 41; i < 48; i++) {
    board.push({ type: 'DEADEND' });
  }
  board[48] = {};

  return board;
}

export function createInitialGameState(): GameState {
  const board = createInitialBoard();

  return {
    board,
    currentPlayer: 'B',
    winner: null,
    winReason: {
      B: null,
      W: null,
    },
    winHighlightIndices: [],
    midTerminal: {
      player: null,
      highlightIndices: [],
    },
    bulletsUsed: {
      B: 0,
      W: 0,
    },
    score: {
      B: 0,
      W: 0,
    },
    turnRotation: 0,
    turnStartEmpty: getEmptyIndex(board),
    jumpEmpty: {
      B: null,
      W: null,
    },
    reposition: null,
  };
}

function getOpponent(player: Player): Player {
  return player === 'B' ? 'W' : 'B';
}

function getOppositeEdgeIndex(index: number | null) {
  if (index === null || index < 0) return null;

  const x = index % SIZE;
  const y = Math.floor(index / SIZE);

  if (y === 0) return (SIZE - 1) * SIZE + x;
  if (y === SIZE - 1) return x;
  if (x === 0) return y * SIZE + (SIZE - 1);
  if (x === SIZE - 1) return y * SIZE;
  return null;
}

export function getTriangleBlockedIndices(jumpEmpty: Record<Player, number | null>) {
  const blocked = new Set<number>();

  for (const index of [jumpEmpty.B, jumpEmpty.W]) {
    if (index !== null && index >= 0) {
      blocked.add(index);
    }

    const opposite = getOppositeEdgeIndex(index);
    if (opposite !== null && opposite >= 0) {
      blocked.add(opposite);
    }
  }

  return [...blocked];
}

function mergeWinners(
  first: GameState['winner'],
  second: GameState['winner'],
): GameState['winner'] {
  if (!first) return second;
  if (!second) return first;
  if (first === 'BW' || second === 'BW') return 'BW';
  if (first !== second) return 'BW';
  return first;
}

export function getTerminalHighlightIndices(board: Cell[], winner: Player) {
  const termIndex = board.findIndex((cell) => cell.type === 'TERM');
  if (termIndex === -1) return [];

  const highlights = new Set<number>([termIndex]);
  const x = termIndex % SIZE;
  const y = Math.floor(termIndex / SIZE);
  const directions =
    winner === 'B'
      ? [
          [1, 0],
          [0, 1],
        ]
      : [
          [-1, 0],
          [0, -1],
        ];
  const pilotTypes = [getPilotType(winner), getDoublePilotType(winner)];

  for (const [dx, dy] of directions) {
    const nx = x + dx;
    const ny = y + dy;

    if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE) continue;

    const index = ny * SIZE + nx;
    if (pilotTypes.includes(board[index]?.type as CellType)) {
      highlights.add(index);
    }
  }

  return [...highlights];
}

function getScoreHighlightIndices(
  board: Cell[],
  disconnected: number[],
  player: Player,
) {
  return disconnected.filter((index) => getScoreDelta(board[index]?.type, player) !== 0);
}

function mergeHighlightIndices(...groups: number[][]) {
  return [...new Set(groups.flat())];
}

export function getWinner(board: Cell[]): GameState['winner'] {
  const termIndex = board.findIndex((cell) => cell.type === 'TERM');
  if (termIndex === -1) return null;

  const x = termIndex % SIZE;
  const y = Math.floor(termIndex / SIZE);

  const getTypeAt = (dx: number, dy: number) => {
    const nx = x + dx;
    const ny = y + dy;

    if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE) return undefined;

    return board[ny * SIZE + nx]?.type;
  };

  const blackWins =
    getTypeAt(1, 0) === 'BP' ||
    getTypeAt(1, 0) === 'BPP' ||
    getTypeAt(0, 1) === 'BP' ||
    getTypeAt(0, 1) === 'BPP';

  const whiteWins =
    getTypeAt(-1, 0) === 'WP' ||
    getTypeAt(-1, 0) === 'WPP' ||
    getTypeAt(0, -1) === 'WP' ||
    getTypeAt(0, -1) === 'WPP';

  if (blackWins && whiteWins) return 'BW';
  if (blackWins) return 'B';
  if (whiteWins) return 'W';
  return null;
}

export function getEmptyIndex(board: Cell[]) {
  return board.findIndex((cell) => cell.type === undefined);
}

export function getDisconnectedIndices(board: Cell[]) {
  const termIndex = board.findIndex((cell) => cell.type === 'TERM');
  if (termIndex === -1) return [];

  const visited = new Set<number>();
  const queue = [termIndex];
  visited.add(termIndex);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const x = current % SIZE;
    const y = Math.floor(current / SIZE);
    const neighbors = [
      [x, y - 1],
      [x, y + 1],
      [x - 1, y],
      [x + 1, y],
    ];

    for (const [nx, ny] of neighbors) {
      if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE) continue;

      const nextIndex = ny * SIZE + nx;
      const nextType = board[nextIndex]?.type;

      if (!isAliveCellType(nextType) || visited.has(nextIndex)) continue;

      visited.add(nextIndex);
      queue.push(nextIndex);
    }
  }

  return board
    .map((cell, index) => {
      if (!cell.type) return null;
      if (cell.type === 'TERM' || cell.type === 'DEADEND') return null;
      if (isDeadCellType(cell.type)) return null;
      if (visited.has(index)) return null;
      return index;
    })
    .filter((index): index is number => index !== null);
}

export function applyDeaths(board: Cell[], player: Player) {
  const disconnected = getDisconnectedIndices(board);

  return board.map((cell, index) => {
    if (!disconnected.includes(index)) return cell;

    return {
      ...cell,
      type: toDeadType(cell.type),
      imageSrc: getDeadImageSrc(cell.type, player),
    };
  });
}

function getScoreDelta(type: CellType | undefined, player: Player) {
  if (type === 'TARGET') return 1;
  if (type === getOwnedTargetType(player)) return -1;
  if (type === getOwnedTargetType(getOpponent(player))) return 2;
  return 0;
}

function getPerimeterPosition(index: number) {
  const x = index % SIZE;
  const y = Math.floor(index / SIZE);

  // Top edge: left -> right
  if (y === 0) return x;

  // Right edge: top -> bottom, excluding top-right corner
  if (x === SIZE - 1) return SIZE - 1 + y;

  // Bottom edge: right -> left, excluding bottom-right corner
  if (y === SIZE - 1) return (SIZE - 1) * 2 + (SIZE - 1 - x);

  // Left edge: bottom -> top, excluding both corners
  if (x === 0) return (SIZE - 1) * 3 + (SIZE - 1 - y);

  return null;
}

function getRotationDelta(beforeEmpty: number, afterEmpty: number) {
  const before = getPerimeterPosition(beforeEmpty);
  const after = getPerimeterPosition(afterEmpty);

  if (before === null || after === null) return 0;

  let delta = after - before;

  if (delta > PERIMETER_LENGTH / 2) {
    delta -= PERIMETER_LENGTH;
  }

  if (delta < -PERIMETER_LENGTH / 2) {
    delta += PERIMETER_LENGTH;
  }

  return delta;
}

function isJumpMove(beforeEmpty: number, afterEmpty: number) {
  const bx = beforeEmpty % SIZE;
  const by = Math.floor(beforeEmpty / SIZE);
  const ax = afterEmpty % SIZE;
  const ay = Math.floor(afterEmpty / SIZE);

  const isOppositeJump =
    (bx === ax && Math.abs(by - ay) === SIZE - 1) ||
    (by === ay && Math.abs(bx - ax) === SIZE - 1);

  const isCorner = (x: number, y: number) =>
    (x === 0 || x === SIZE - 1) &&
    (y === 0 || y === SIZE - 1);

  const isCornerJump =
    isCorner(bx, by) && isCorner(ax, ay);

  return isOppositeJump && !isCornerJump;
}

function resolveAfterMove(
  state: GameState,
  board: Cell[],
  allowReposition: boolean,
  shouldEndTurn: boolean,
  moveDistance: number,
): GameState {
  if (!shouldEndTurn) {
    const opponent = getOpponent(state.currentPlayer);
    const previewWinner = getWinner(board);
    const currentPlayerHasTerminal =
      previewWinner === state.currentPlayer || previewWinner === 'BW';
    const midTerminalPlayer =
      previewWinner === opponent || previewWinner === 'BW'
        ? opponent
        : null;

    if (currentPlayerHasTerminal) {
      const winHighlightIndices =
        previewWinner === 'BW'
          ? mergeHighlightIndices(
              getTerminalHighlightIndices(board, 'B'),
              getTerminalHighlightIndices(board, 'W'),
            )
          : getTerminalHighlightIndices(board, state.currentPlayer);

      return {
        ...state,
        board,
        winner: previewWinner,
        winReason:
          previewWinner === 'BW'
            ? { B: 'terminal', W: 'terminal' }
            : state.currentPlayer === 'B'
            ? { B: 'terminal', W: null }
            : { B: null, W: 'terminal' },
        winHighlightIndices,
        midTerminal: {
          player: null,
          highlightIndices: [],
        },
        turnRotation: state.turnRotation + moveDistance,
        turnStartEmpty: state.turnStartEmpty,
        jumpEmpty: state.jumpEmpty,
        reposition: null,
      };
    }

    return {
      ...state,
      board,
      winReason: { B: null, W: null },
      winHighlightIndices: [],
      midTerminal: {
        player: midTerminalPlayer,
        highlightIndices: midTerminalPlayer
          ? getTerminalHighlightIndices(board, midTerminalPlayer)
          : [],
      },
      turnRotation: state.turnRotation + moveDistance,
      turnStartEmpty: state.turnStartEmpty,
      jumpEmpty: state.jumpEmpty,
      reposition: null,
    };
  }

  const afterJumpEmpty = getEmptyIndex(board);
  const nextJumpEmpty = {
    ...state.jumpEmpty,
    [state.currentPlayer]: afterJumpEmpty,
  };
  const opponent = getOpponent(state.currentPlayer);
  const midTerminalWinner =
    state.midTerminal.player === opponent ? opponent : null;

  const terminalWinner = getWinner(board);
  const appliedDeathsBoard = applyDeaths(board, state.currentPlayer);
  const deferredOpponentTerminalWin =
    terminalWinner && terminalWinner !== 'BW' && terminalWinner !== state.currentPlayer
      ? terminalWinner
      : null;

  if (terminalWinner === state.currentPlayer || terminalWinner === 'BW') {
    const winHighlightIndices =
      terminalWinner === 'BW'
        ? mergeHighlightIndices(
            getTerminalHighlightIndices(board, 'B'),
            getTerminalHighlightIndices(board, 'W'),
          )
        : mergeHighlightIndices(
            getTerminalHighlightIndices(board, terminalWinner),
            midTerminalWinner ? getTerminalHighlightIndices(board, midTerminalWinner) : [],
          );
    const winner = mergeWinners(terminalWinner, midTerminalWinner);

    return {
      ...state,
      board,
      winner,
      winReason: {
        B:
          terminalWinner === 'BW' || terminalWinner === 'B'
            ? 'terminal'
            : midTerminalWinner === 'B'
            ? 'mid-terminal'
            : null,
        W:
          terminalWinner === 'BW' || terminalWinner === 'W'
            ? 'terminal'
            : midTerminalWinner === 'W'
            ? 'mid-terminal'
            : null,
      },
      winHighlightIndices,
      midTerminal: {
        player: null,
        highlightIndices: [],
      },
      turnRotation: 0,
      turnStartEmpty: getEmptyIndex(board),
      jumpEmpty: nextJumpEmpty,
      reposition: null,
    };
  }

  const disconnected = getDisconnectedIndices(board);
  const scoreDelta = disconnected.reduce(
    (sum, index) => sum + getScoreDelta(board[index]?.type, state.currentPlayer),
    0,
  );
  const scoreHighlightIndices = getScoreHighlightIndices(
    board,
    disconnected,
    state.currentPlayer,
  );
  const ownPilotIndex = disconnected.find((index) =>
    isPilotType(board[index]?.type, state.currentPlayer),
  );
  const repositionIndices =
    allowReposition && ownPilotIndex !== undefined
      ? getRepositionIndices(board, state.currentPlayer, ownPilotIndex)
      : [];
  const nextBulletsUsed = {
    ...state.bulletsUsed,
    [state.currentPlayer]: state.bulletsUsed[state.currentPlayer] + disconnected.length,
  };
  const nextScore = {
    ...state.score,
    [state.currentPlayer]: state.score[state.currentPlayer] + scoreDelta,
  };

  if (allowReposition && ownPilotIndex !== undefined) {
    if (repositionIndices.length === 0) {
      return {
        ...state,
        board: appliedDeathsBoard,
        winner: mergeWinners(deferredOpponentTerminalWin, opponent),
        winReason: {
          B:
            deferredOpponentTerminalWin === 'B'
              ? 'terminal'
              : midTerminalWinner === 'B'
              ? 'mid-terminal'
              : state.currentPlayer === 'B'
              ? 'misTensei'
              : null,
          W:
            deferredOpponentTerminalWin === 'W'
              ? 'terminal'
              : midTerminalWinner === 'W'
              ? 'mid-terminal'
              : state.currentPlayer === 'W'
              ? 'misTensei'
              : null,
        },
        winHighlightIndices: mergeHighlightIndices(
          deferredOpponentTerminalWin
            ? getTerminalHighlightIndices(board, deferredOpponentTerminalWin)
            : [],
          midTerminalWinner ? getTerminalHighlightIndices(board, midTerminalWinner) : [],
          [ownPilotIndex],
        ),
        midTerminal: {
          player: null,
          highlightIndices: [],
        },
        bulletsUsed: nextBulletsUsed,
        score: nextScore,
        turnRotation: 0,
        turnStartEmpty: getEmptyIndex(board),
        jumpEmpty: nextJumpEmpty,
        reposition: null,
      };
    }

    return {
      ...state,
      board,
      winner: null,
      winReason: { B: null, W: null },
      winHighlightIndices: [],
      turnRotation: state.turnRotation + moveDistance,
      turnStartEmpty: state.turnStartEmpty,
      jumpEmpty: nextJumpEmpty,
      reposition: {
        player: state.currentPlayer,
        from: ownPilotIndex,
        remainingPilots:
          board[ownPilotIndex]?.type === getDoublePilotType(state.currentPlayer) ? 2 : 1,
        endTurnAfterResolution: shouldEndTurn,
      },
    };
  }

  if (midTerminalWinner) {
    return {
      ...state,
      board: appliedDeathsBoard,
      winner: mergeWinners(deferredOpponentTerminalWin, midTerminalWinner),
      winReason: {
        B:
          deferredOpponentTerminalWin === 'B'
            ? 'terminal'
            : midTerminalWinner === 'B'
            ? 'mid-terminal'
            : null,
        W:
          deferredOpponentTerminalWin === 'W'
            ? 'terminal'
            : midTerminalWinner === 'W'
            ? 'mid-terminal'
            : null,
      },
      winHighlightIndices: mergeHighlightIndices(
        deferredOpponentTerminalWin
          ? getTerminalHighlightIndices(board, deferredOpponentTerminalWin)
          : [],
        getTerminalHighlightIndices(board, midTerminalWinner),
      ),
      midTerminal: {
        player: null,
        highlightIndices: [],
      },
      bulletsUsed: nextBulletsUsed,
      score: nextScore,
      turnRotation: 0,
      turnStartEmpty: getEmptyIndex(board),
      jumpEmpty: nextJumpEmpty,
      reposition: null,
    };
  }

  if (nextBulletsUsed[state.currentPlayer] > 6) {
    const winHighlightIndices = mergeHighlightIndices(
      deferredOpponentTerminalWin
        ? getTerminalHighlightIndices(board, deferredOpponentTerminalWin)
        : [],
      scoreHighlightIndices,
    );

    return {
      ...state,
      board: appliedDeathsBoard,
      winner: mergeWinners(deferredOpponentTerminalWin, opponent),
      winReason: {
        B:
          deferredOpponentTerminalWin === 'B'
            ? 'terminal'
            : midTerminalWinner === 'B'
            ? 'mid-terminal'
            : state.currentPlayer === 'B'
            ? 'bullets'
            : null,
        W:
          deferredOpponentTerminalWin === 'W'
            ? 'terminal'
            : midTerminalWinner === 'W'
            ? 'mid-terminal'
            : state.currentPlayer === 'W'
            ? 'bullets'
            : null,
      },
      winHighlightIndices: mergeHighlightIndices(
        winHighlightIndices,
        midTerminalWinner ? getTerminalHighlightIndices(board, midTerminalWinner) : [],
      ),
      midTerminal: {
        player: null,
        highlightIndices: [],
      },
      bulletsUsed: nextBulletsUsed,
      score: nextScore,
      turnRotation: 0,
      turnStartEmpty: getEmptyIndex(board),
      jumpEmpty: nextJumpEmpty,
      reposition: null,
    };
  }

  if (nextScore[state.currentPlayer] >= 5) {
    const winHighlightIndices = mergeHighlightIndices(
      deferredOpponentTerminalWin ? getTerminalHighlightIndices(board, deferredOpponentTerminalWin) : [],
      scoreHighlightIndices,
    );

    return {
      ...state,
      board: appliedDeathsBoard,
      winner: mergeWinners(deferredOpponentTerminalWin, state.currentPlayer),
      winReason: {
        B:
          deferredOpponentTerminalWin === 'B'
            ? 'terminal'
            : midTerminalWinner === 'B'
            ? 'mid-terminal'
            : state.currentPlayer === 'B'
            ? 'score'
            : null,
        W:
          deferredOpponentTerminalWin === 'W'
            ? 'terminal'
            : midTerminalWinner === 'W'
            ? 'mid-terminal'
            : state.currentPlayer === 'W'
            ? 'score'
            : null,
      },
      winHighlightIndices: mergeHighlightIndices(
        winHighlightIndices,
        midTerminalWinner ? getTerminalHighlightIndices(board, midTerminalWinner) : [],
      ),
      midTerminal: {
        player: null,
        highlightIndices: [],
      },
      bulletsUsed: nextBulletsUsed,
      score: nextScore,
      turnRotation: 0,
      turnStartEmpty: getEmptyIndex(board),
      jumpEmpty: nextJumpEmpty,
      reposition: null,
    };
  }

  const opponentPilotIndex = disconnected.find(
    (index) => isPilotType(board[index]?.type, opponent),
  );

  if (opponentPilotIndex !== undefined) {
    const winHighlightIndices = mergeHighlightIndices(
      deferredOpponentTerminalWin ? getTerminalHighlightIndices(board, deferredOpponentTerminalWin) : [],
      [opponentPilotIndex],
    );

    return {
      ...state,
      board: appliedDeathsBoard,
      winner: mergeWinners(deferredOpponentTerminalWin, state.currentPlayer),
      winReason: {
        B:
          deferredOpponentTerminalWin === 'B'
            ? 'terminal'
            : midTerminalWinner === 'B'
            ? 'mid-terminal'
            : state.currentPlayer === 'B'
            ? 'pilot'
            : null,
        W:
          deferredOpponentTerminalWin === 'W'
            ? 'terminal'
            : midTerminalWinner === 'W'
            ? 'mid-terminal'
            : state.currentPlayer === 'W'
            ? 'pilot'
            : null,
      },
      winHighlightIndices: mergeHighlightIndices(
        winHighlightIndices,
        midTerminalWinner ? getTerminalHighlightIndices(board, midTerminalWinner) : [],
      ),
      midTerminal: {
        player: null,
        highlightIndices: [],
      },
      bulletsUsed: nextBulletsUsed,
      score: nextScore,
      turnRotation: 0,
      turnStartEmpty: getEmptyIndex(board),
      jumpEmpty: nextJumpEmpty,
      reposition: null,
    };
  }

  if (deferredOpponentTerminalWin) {
    return {
      ...state,
      board: appliedDeathsBoard,
      winner: deferredOpponentTerminalWin,
      winReason: {
        B: deferredOpponentTerminalWin === 'B' ? 'terminal' : null,
        W: deferredOpponentTerminalWin === 'W' ? 'terminal' : null,
      },
      winHighlightIndices: getTerminalHighlightIndices(board, deferredOpponentTerminalWin),
      midTerminal: {
        player: null,
        highlightIndices: [],
      },
      bulletsUsed: nextBulletsUsed,
      score: nextScore,
      turnRotation: 0,
      turnStartEmpty: getEmptyIndex(board),
      jumpEmpty: nextJumpEmpty,
      reposition: null,
    };
  }

  return {
    board: applyDeaths(board, state.currentPlayer),
    currentPlayer: shouldEndTurn
      ? getOpponent(state.currentPlayer)
      : state.currentPlayer,
    winner: null,
    winReason: { B: null, W: null },
    winHighlightIndices: [],
    midTerminal: {
      player: null,
      highlightIndices: [],
    },
    bulletsUsed: nextBulletsUsed,
    score: nextScore,
    turnRotation: 0,
    turnStartEmpty: getEmptyIndex(board),
    jumpEmpty: nextJumpEmpty,
    reposition: null,
  };
}

export function getMovableIndices(board: Cell[], turnRotation: number) {
  const empty = getEmptyIndex(board);
  if (empty === -1) return [];

  const x = empty % SIZE;
  const y = Math.floor(empty / SIZE);
  const indices: number[] = [];

  if (y === 0 || y === SIZE - 1) {
    for (let i = 0; i < SIZE; i++) {
      indices.push(y * SIZE + i);
    }

    const oppositeY = y === 0 ? SIZE - 1 : 0;
    indices.push(oppositeY * SIZE + x);
  }

  if (x === 0 || x === SIZE - 1) {
    for (let i = 0; i < SIZE; i++) {
      indices.push(i * SIZE + x);
    }

    const oppositeX = x === 0 ? SIZE - 1 : 0;
    indices.push(y * SIZE + oppositeX);
  }

  return [...new Set(indices)].filter((index) => {
    const result = multiSwap(board, index, turnRotation);
    return result !== null;
  });
}

export function multiSwap(
  board: Cell[],
  from: number,
  turnRotation: number,
): { board: Cell[]; moveDistance: number } | null {
  const newBoard = board.map((cell) => ({ ...cell }));
  const startEmpty = getEmptyIndex(newBoard);
  let empty = startEmpty;

  if (empty === -1) return null;

  const ex0 = empty % SIZE;
  const ey0 = Math.floor(empty / SIZE);
  const fx = from % SIZE;
  const fy = Math.floor(from / SIZE);

  if (!(ex0 === fx || ey0 === fy)) return null;

  while (empty !== from) {
    const ex = empty % SIZE;
    const ey = Math.floor(empty / SIZE);

    let next: number;

    if (ex === fx) {
      next = ey < fy ? empty + SIZE : empty - SIZE;
    } else {
      next = ex < fx ? empty + 1 : empty - 1;
    }

    const temp = newBoard[next];
    newBoard[next] = newBoard[empty];
    newBoard[empty] = temp;

    empty = next;
  }

  const isJump = isJumpMove(startEmpty, from);
  const moveDistance = isJump ? 0 : getRotationDelta(startEmpty, from);
  const nextRotation = turnRotation + moveDistance;

  if (nextRotation >= PERIMETER_LENGTH || nextRotation <= -PERIMETER_LENGTH) {
    return null;
  }

  return { board: newBoard, moveDistance };
}

export function applySlide(state: GameState, from: number): GameState | null {
  if (state.winner || state.reposition) return null;
  const blocked = getTriangleBlockedIndices(state.jumpEmpty);
  if (blocked.includes(from) && from !== state.turnStartEmpty) return null;

  const beforeEmpty = getEmptyIndex(state.board);
  const result = multiSwap(state.board, from, state.turnRotation);
  if (!result) return null;
  const nextBoard = result.board;
  const afterEmpty = getEmptyIndex(nextBoard);
  const shouldEndTurn =
    beforeEmpty !== -1 && afterEmpty !== -1
      ? isJumpMove(beforeEmpty, afterEmpty)
      : false;

  return resolveAfterMove(
    state,
    nextBoard,
    true,
    shouldEndTurn,
    result.moveDistance,
  );
}

export function getRepositionIndices(board: Cell[], player: Player, excludedIndex?: number) {
  const targetType = getOwnedTargetType(player);
  const pilotType = getPilotType(player);
  const disconnected = new Set(getDisconnectedIndices(board));

  return board
    .map((cell, index) =>
      index !== excludedIndex &&
      !disconnected.has(index) &&
      (cell.type === targetType || cell.type === pilotType)
        ? index
        : null,
    )
    .filter((index): index is number => index !== null);
}

export function applyReposition(state: GameState, to: number): GameState | null {
  if (!state.reposition || state.winner) return null;

  const { player, from, remainingPilots, endTurnAfterResolution } = state.reposition;
  const targetType = getOwnedTargetType(player);
  const pilotType = getPilotType(player);
  const doublePilotType = getDoublePilotType(player);
  const repositionIndices = getRepositionIndices(state.board, player, from);

  if (!repositionIndices.includes(to)) return null;

  const nextBoard = state.board.map((cell) => ({ ...cell }));
  nextBoard[from] = { type: targetType };
  const destinationType = state.board[to]?.type;

  if (destinationType === targetType) {
    nextBoard[to] = { type: pilotType };
  } else if (destinationType === pilotType) {
    nextBoard[to] = { type: doublePilotType };
  } else {
    return null;
  }

  if (remainingPilots > 1) {
    return {
      ...state,
      board: nextBoard,
      winReason: { B: null, W: null },
      winHighlightIndices: [],
      midTerminal: {
        player: null,
        highlightIndices: [],
      },
      reposition: {
        player,
        from,
        remainingPilots: remainingPilots - 1,
        endTurnAfterResolution,
      },
    };
  }

  return resolveAfterMove(state, nextBoard, false, endTurnAfterResolution, 0);
}

export function getCellLabel(cell: Cell) {
  return cell.type ?? 'EMPTY';
}
