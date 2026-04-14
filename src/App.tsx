import { useEffect, useMemo, useState } from 'react';
import {
  getCellLabel,
  getEmptyIndex,
  type GameState,
  getMovableIndices,
  getRepositionIndices,
  getTerminalHighlightIndices,
  getTriangleBlockedIndices,
  getWinner,
  SIZE,
  type Cell,
  type Player,
} from './game';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
type SessionPlayer = Player | 'S';

function getCellImageSrc(cell: Cell) {
  if (cell.imageSrc) {
    return cell.imageSrc;
  }

  switch (cell.type) {
    case 'BP':
      return '/bp.png';
    case 'BPP':
      return '/bpp.png';
    case 'WP':
      return '/wp.png';
    case 'WPP':
      return '/wpp.png';
    case 'DEADEND':
      return '/deadend.png';
    case 'TARGET':
      return '/target.png';
    case 'TARGET:B':
      return '/targetb.png';
    case 'TARGET:W':
      return '/targetw.png';
    case 'TERM':
      return '/term.png';
    case undefined:
      return '/empty.png';
    default:
      return null;
  }
}

function Board({
  board,
  movable,
  onCellClick,
  mode,
  repositionSource,
  jumpEmptyB,
  jumpEmptyW,
  winHighlightIndices,
  swapAnimation,
  slideAnimations,
  animationProgress,
  scale,
}: {
  board: Cell[];
  movable: number[];
  onCellClick: (index: number) => void;
  mode: 'slide' | 'reposition';
  repositionSource: number | null;
  jumpEmptyB: number | null;
  jumpEmptyW: number | null;
  winHighlightIndices: Set<number>;
  swapAnimation: { from: number; to: number } | null;
  slideAnimations: { from: number; to: number }[] | null;
  animationProgress: number;
  scale: number;
}) {
  const FULL_SIZE = SIZE + 2;
  const cellSize = 72 * scale;
  const triangleWidth = 32 * scale;
  const triangleHeight = 28 * scale;
  const gap = 6 * scale;
  const borderWidth = Math.max(1, Math.round(3 * scale));
  const thinBorderWidth = Math.max(1, Math.round(scale));
  const padding = Math.max(1, Math.round(2 * scale));

  function isNearJumpEmpty(x: number, y: number, jumpEmpty: number | null) {
    if (jumpEmpty === null || jumpEmpty < 0) return false;

    const emptyX = (jumpEmpty % SIZE) + 1;
    const emptyY = Math.floor(jumpEmpty / SIZE) + 1;

    return (
      (x === emptyX && y === emptyY - 1) ||
      (x === emptyX && y === emptyY + 1) ||
      (x === emptyX - 1 && y === emptyY) ||
      (x === emptyX + 1 && y === emptyY)
    );
  }

  function isOppositeJumpTriangle(x: number, y: number, jumpEmpty: number | null) {
    if (jumpEmpty === null || jumpEmpty < 0) return false;

    const emptyX = jumpEmpty % SIZE;
    const emptyY = Math.floor(jumpEmpty / SIZE);

    if (emptyY === 0) {
      return x === emptyX + 1 && y === FULL_SIZE - 1;
    }

    if (emptyY === SIZE - 1) {
      return x === emptyX + 1 && y === 0;
    }

    if (emptyX === 0) {
      return x === FULL_SIZE - 1 && y === emptyY + 1;
    }

    if (emptyX === SIZE - 1) {
      return x === 0 && y === emptyY + 1;
    }

    return false;
  }

  function renderTriangle(x: number, y: number) {
    const min = 2;
    const max = 6;

    let rotation: number | null = null;

    if (y === 0 && x >= min && x <= max) rotation = 180;
    if (y === FULL_SIZE - 1 && x >= min && x <= max) rotation = 0;
    if (x === 0 && y >= min && y <= max) rotation = 90;
    if (x === FULL_SIZE - 1 && y >= min && y <= max) rotation = -90;

    if (rotation === null) {
      return <div key={`empty-${x}-${y}`} style={{ width: cellSize, height: cellSize }} />;
    }

    const isNearB = isNearJumpEmpty(x, y, jumpEmptyB);
    const isNearW = isNearJumpEmpty(x, y, jumpEmptyW);
    const isOppositeB = isOppositeJumpTriangle(x, y, jumpEmptyB);
    const isOppositeW = isOppositeJumpTriangle(x, y, jumpEmptyW);
    const color = isNearB
      ? '#1f2937'
      : isNearW
      ? '#ffffff'
      : '#9ca3af';

    return (
      <div
        key={`triangle-${x}-${y}`}
        style={{
          width: cellSize,
          height: cellSize,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ position: 'relative', width: triangleWidth, height: triangleHeight }}>
          <svg
            viewBox="0 0 32 28"
            style={{
              width: triangleWidth,
              height: triangleHeight,
              transform: `rotate(${rotation}deg)`,
              overflow: 'visible',
            }}
          >
            {(isOppositeB || isOppositeW) && (
              <polygon
                points="16,2 2,26 30,26"
                fill="transparent"
                stroke={isOppositeB ? '#111111' : '#ffffff'}
                strokeWidth={borderWidth}
                strokeLinejoin="round"
              />
            )}
            {!isOppositeB && !isOppositeW && (
              <polygon
                points="16,2 2,26 30,26"
                fill={color}
              />
            )}
          </svg>
        </div>
      </div>
    );
  }

  function getAnimationStyle(index: number) {
    if (swapAnimation) {
      const { from, to } = swapAnimation;

      if (index !== from && index !== to) return {};

      const fromX = from % SIZE;
      const fromY = Math.floor(from / SIZE);
      const toX = to % SIZE;
      const toY = Math.floor(to / SIZE);

      const dx = (toX - fromX) * cellSize;
      const dy = (toY - fromY) * cellSize;

      if (index === from) {
        return {
          transform: `translate(${dx * animationProgress}px, ${dy * animationProgress}px)`,
          position: 'relative' as const,
          zIndex: 999,
        };
      }

      if (index === to) {
        return {
          transform: `translate(${-dx * animationProgress}px, ${-dy * animationProgress}px)`,
          position: 'relative' as const,
          zIndex: 999,
        };
      }
    }

    if (slideAnimations) {
      const anim = slideAnimations.find(a => a.from === index);
      if (!anim) return {};

      const fromX = anim.from % SIZE;
      const fromY = Math.floor(anim.from / SIZE);
      const toX = anim.to % SIZE;
      const toY = Math.floor(anim.to / SIZE);

      const dx = (toX - fromX) * cellSize;
      const dy = (toY - fromY) * cellSize;

      return {
        transform: `translate(${dx * animationProgress}px, ${dy * animationProgress}px)`,
        position: 'relative' as const,
        zIndex: 10,
      };
    }

    return {};
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${FULL_SIZE}, ${cellSize}px)`,
        gap,
      }}
    >
      {Array.from({ length: FULL_SIZE * FULL_SIZE }).map((_, gridIndex) => {
        const x = gridIndex % FULL_SIZE;
        const y = Math.floor(gridIndex / FULL_SIZE);

        if (x >= 1 && x <= SIZE && y >= 1 && y <= SIZE) {
          const boardIndex = (y - 1) * SIZE + (x - 1);
          const cell = board[boardIndex];
          const isMovable = movable.includes(boardIndex);
          const isSource = repositionSource === boardIndex;
          const isWinHighlight = winHighlightIndices.has(boardIndex);

          return (
            <button
              key={boardIndex}
              type="button"
              disabled={!isMovable}
              onClick={() => onCellClick(boardIndex)}
              style={{
                height: cellSize,
                border: isSource
                  ? `${borderWidth}px solid #d92d20`
                  : isMovable && mode === 'reposition'
                  ? `${borderWidth}px solid #16a34a`
                  : isWinHighlight
                  ? `${borderWidth}px dashed #d92d20`
                  : `${thinBorderWidth}px solid #999`,
                background: isMovable
                  ? mode === 'reposition'
                    ? '#f3f3f3'
                    : '#ffe58f'
                  : isWinHighlight
                  ? '#fde7e7'
                  : '#f3f3f3',
                color: '#111',
                cursor: isMovable ? 'pointer' : 'default',
                fontSize: 12,
                lineHeight: 1.3,
                padding,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',

                ...getAnimationStyle(boardIndex),
              }}
            >
              {getCellImageSrc(cell) ? (
                <img
                  src={getCellImageSrc(cell)!}
                  alt={getCellLabel(cell)}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    pointerEvents: 'none',
                  }}
                />
              ) : (
                <div>{getCellLabel(cell)}</div>
              )}
            </button>
          );
        }

        return renderTriangle(x, y);
      })}
    </div>
  );
}

export default function App() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [displayBoard, setDisplayBoard] = useState<Cell[] | null>(null);
  const [roomIdInput, setRoomIdInput] = useState('');
  const [session, setSession] = useState<{ roomId: string; player: SessionPlayer } | null>(null);
  const [seats, setSeats] = useState<{ B: boolean; W: boolean; spectators: number } | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSidePanels, setShowSidePanels] = useState(true);
  const [boardScale, setBoardScale] = useState<1 | 0.6>(1);
  const [swapAnimation, setSwapAnimation] = useState<{from: number; to: number;} | null>(null);
  const [animationProgress, setAnimationProgress] = useState(0);
  const [pendingMove, setPendingMove] = useState<number | null>(null);
  const [slideAnimations, setSlideAnimations] = useState<{ from: number; to: number }[] | null>(null);
  const [slideQueue, setSlideQueue] = useState<{from:number;to:number}[]>([]);
  const [currentEmpty, setCurrentEmpty] = useState<number | null>(null);
  const [optimisticJumpEmpty, setOptimisticJumpEmpty] = useState<{ player: Player; index: number } | null>(null);
  const state = gameState;

  function swapBoardCells(board: Cell[], from: number, to: number) {
    const nextBoard = board.map((cell) => ({ ...cell }));
    const temp = nextBoard[from];
    nextBoard[from] = nextBoard[to];
    nextBoard[to] = temp;
    return nextBoard;
  }

  async function requestJson<T>(input: RequestInfo, init?: RequestInit) {
    const url = typeof input === 'string' && input.startsWith('/api')
      ? `${API_BASE_URL}${input}`
      : input;
    const response = await fetch(url, init);
    const data = (await response.json()) as T & { error?: string };

    if (!response.ok) {
      throw new Error(data.error ?? 'Request failed.');
    }

    return data;
  }

  async function refreshRoom(nextSession = session) {
    if (!nextSession) return;

    const data = await requestJson<{
      roomId: string;
      state: GameState;
      seats: { B: boolean; W: boolean; spectators: number };
    }>(`/api/rooms/${nextSession.roomId}`);

    if (!swapAnimation && !slideAnimations) {
      setGameState(data.state);
      setDisplayBoard(data.state.board);
      setOptimisticJumpEmpty(null);
    }
    setSeats(data.seats);
  }

  function buildSlideAnimations(from: number, empty: number) {
    const result = [];
    let current = empty;

    while (current !== from) {
      const cx = current % SIZE;
      const cy = Math.floor(current / SIZE);
      const fx = from % SIZE;
      const fy = Math.floor(from / SIZE);

      let next;

      if (cx === fx) {
        next = cy < fy ? current + SIZE : current - SIZE;
      } else {
        next = cx < fx ? current + 1 : current - 1;
      }

      result.push({ from: next, to: current });
      current = next;
    }

    return result;
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

    return isOppositeJump && !(isCorner(bx, by) && isCorner(ax, ay));
  }

  useEffect(() => {
    if (!session) return;

    void refreshRoom(session);
    const intervalId = window.setInterval(() => {
      if (swapAnimation) return;
      void refreshRoom(session).catch((fetchError: unknown) => {
        setError(fetchError instanceof Error ? fetchError.message : 'Failed to sync room.');
      });
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [session]);

  useEffect(() => {
    const anim = swapAnimation ?? slideAnimations;
    if (!anim) return;

    let frame = 0;
    const totalFrames = 15;

    function tick() {
      frame++;
      setAnimationProgress(frame / totalFrames);

      if (frame < totalFrames) {
        requestAnimationFrame(tick);
      } else {
        if (slideAnimations) {
          const completedStep = slideAnimations[0];
          setDisplayBoard((prevBoard) => {
            if (!prevBoard || !completedStep) return prevBoard;
            return swapBoardCells(prevBoard, completedStep.from, completedStep.to);
          });
          setCurrentEmpty(completedStep?.from ?? null);

          const nextQueue = [...slideQueue];

          if (nextQueue.length > 0) {
            const next = nextQueue.shift()!;
            setSlideQueue(nextQueue);
            setSlideAnimations([next]);
            setAnimationProgress(0);
            return;
          }
        }

        // 完全終了
        setSwapAnimation(null);
        setSlideAnimations(null);
        setAnimationProgress(0);
        setCurrentEmpty(null);

        if (pendingMove !== null) {
          void actuallySendMove(pendingMove);
          setPendingMove(null);
        }
      }
    }

    requestAnimationFrame(tick);
  }, [swapAnimation, slideAnimations, slideQueue, pendingMove]);

  async function createRoom() {
    setIsLoading(true);
    setError('');

    try {
      const data = await requestJson<{
        roomId: string;
        player: SessionPlayer;
        state: GameState;
        seats: { B: boolean; W: boolean; spectators: number };
      }>('/api/rooms', {
        method: 'POST',
      });

      setSession({ roomId: data.roomId, player: data.player });
      setGameState(data.state);
      setDisplayBoard(data.state.board);
      setOptimisticJumpEmpty(null);
      setSeats(data.seats);
      setRoomIdInput(data.roomId);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Failed to create room.');
    } finally {
      setIsLoading(false);
    }
  }

  async function joinRoom() {
    const normalizedRoomId = roomIdInput.trim().toUpperCase();
    if (!normalizedRoomId) {
      setError('Room ID is required.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const data = await requestJson<{
        roomId: string;
        player: SessionPlayer;
        state: GameState;
        seats: { B: boolean; W: boolean; spectators: number };
      }>(`/api/rooms/${normalizedRoomId}/join`, {
        method: 'POST',
      });

      setSession({ roomId: data.roomId, player: data.player });
      setGameState(data.state);
      setDisplayBoard(data.state.board);
      setOptimisticJumpEmpty(null);
      setSeats(data.seats);
      setRoomIdInput(data.roomId);
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : 'Failed to join room.');
    } finally {
      setIsLoading(false);
    }
  }

  async function watchRoom() {
    const normalizedRoomId = roomIdInput.trim().toUpperCase();
    if (!normalizedRoomId) {
      setError('Room ID is required.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const data = await requestJson<{
        roomId: string;
        player: SessionPlayer;
        state: GameState;
        seats: { B: boolean; W: boolean; spectators: number };
      }>(`/api/rooms/${normalizedRoomId}/watch`, {
        method: 'POST',
      });

      setSession({ roomId: data.roomId, player: data.player });
      setGameState(data.state);
      setDisplayBoard(data.state.board);
      setOptimisticJumpEmpty(null);
      setSeats(data.seats);
      setRoomIdInput(data.roomId);
    } catch (watchError) {
      setError(watchError instanceof Error ? watchError.message : 'Failed to watch room.');
    } finally {
      setIsLoading(false);
    }
  }

  async function submitMove(index: number) {
    if (!session || !gameState) return;

    // reposition
    if (gameState.reposition) {
      const from = gameState.reposition.from;
      setSwapAnimation({ from, to: index });
      setPendingMove(index);
      return;
    }

    const boardForAnimation = displayBoard ?? gameState.board;
    const empty = getEmptyIndex(boardForAnimation);
    if (empty === -1) return;
    const isJump = isJumpMove(empty, index);
    setCurrentEmpty(empty);
    setDisplayBoard(boardForAnimation.map((cell) => ({ ...cell })));
    setOptimisticJumpEmpty(isJump ? { player: gameState.currentPlayer, index } : null);

    const from = index;

    const anims = buildSlideAnimations(from, empty);

    if (anims.length === 0) {
      void actuallySendMove(index);
      setCurrentEmpty(null);
      return;
    }

    setSlideAnimations([anims[0]]);
    setSlideQueue(anims.slice(1));
    setPendingMove(index);
  }

  async function actuallySendMove(index: number) {
    if (!session || !gameState) return;

    setIsLoading(true);
    setError('');

    try {
      const data = await requestJson<{
        roomId: string;
        state: GameState;
        seats: { B: boolean; W: boolean; spectators: number };
      }>(`/api/rooms/${session.roomId}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player: session.player,
          action: gameState.reposition ? 'reposition' : 'slide',
          index,
        }),
      });

      setGameState(data.state);
      setDisplayBoard(data.state.board);
      setOptimisticJumpEmpty(null);
      setSeats(data.seats);
    } catch (e) {
      setOptimisticJumpEmpty(null);
      setError(e instanceof Error ? e.message : 'Failed to submit move.');
    } finally {
      setIsLoading(false);
    }
  }

  const bulletsLeftB = state ? 6 - state.bulletsUsed.B : 6;
  const bulletsLeftW = state ? 6 - state.bulletsUsed.W : 6;
  const scoreB = state?.score.B ?? 0;
  const scoreW = state?.score.W ?? 0;
  const effectiveBoard = displayBoard ?? state?.board ?? [];
  const effectiveEmpty = currentEmpty ?? state?.turnStartEmpty ?? null;
  const effectiveJumpEmpty = state
    ? {
        B:
          state.currentPlayer === 'B'
            ? currentEmpty ??
              (optimisticJumpEmpty?.player === 'B' ? optimisticJumpEmpty.index : state.jumpEmpty.B)
            : state.jumpEmpty.B,
        W:
          state.currentPlayer === 'W'
            ? currentEmpty ??
              (optimisticJumpEmpty?.player === 'W' ? optimisticJumpEmpty.index : state.jumpEmpty.W)
            : state.jumpEmpty.W,
      }
    : { B: null, W: null };
  const blockedIndices = useMemo(
    () => (state ? getTriangleBlockedIndices(effectiveJumpEmpty) : []),
    [effectiveJumpEmpty, state],
  );
  const isMyTurn =
    !!state &&
    !!session &&
    session.player !== 'S' &&
    (state.reposition
      ? state.reposition.player === session.player
      : state.currentPlayer === session.player);

  const movable = useMemo(
    () =>
      !state || state.winner || !isMyTurn
        ? []
        : state.reposition
        ? getRepositionIndices(effectiveBoard, state.reposition.player)
        : getMovableIndices(effectiveBoard, state.turnRotation).filter(
            (index) => !blockedIndices.includes(index) || index === effectiveEmpty,
          ),
    [
      blockedIndices,
      effectiveBoard,
      effectiveEmpty,
      isMyTurn,
      state,
    ],
  );

  const previewTerminalWinner = useMemo(
    () => (state && !state.winner && !state.reposition ? getWinner(effectiveBoard) : null),
    [effectiveBoard, state],
  );

  const winHighlightIndices = useMemo(() => {
    if (!state) {
      return new Set<number>();
    }

    if (state.winHighlightIndices.length > 0) {
      return new Set(state.winHighlightIndices);
    }

    if (previewTerminalWinner === 'B') {
      return new Set(getTerminalHighlightIndices(effectiveBoard, 'B'));
    }

    if (previewTerminalWinner === 'W') {
      return new Set(getTerminalHighlightIndices(effectiveBoard, 'W'));
    }

    if (previewTerminalWinner === 'BW') {
      return new Set([
        ...getTerminalHighlightIndices(effectiveBoard, 'B'),
        ...getTerminalHighlightIndices(effectiveBoard, 'W'),
      ]);
    }

    return new Set<number>();
  }, [effectiveBoard, previewTerminalWinner, state]);

  if (!session || !state) {
    return (
      <main
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#d1d5db',
          padding: 24,
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            width: 360,
            background: '#f8fafc',
            border: '1px solid #94a3b8',
            borderRadius: 16,
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <h1 style={{ margin: 0 }}>Meigeki Tensei Online</h1>
          <div style={{ fontSize: 14, lineHeight: 1.5 }}>
            Create a room as Black, join as White, or watch as Spectator.
          </div>
          <button
            type="button"
            onClick={() => void createRoom()}
            disabled={isLoading}
            style={{
              height: 44,
              border: '1px solid #0f172a',
              background: '#0f172a',
              color: '#fff',
              borderRadius: 10,
              cursor: 'pointer',
              fontWeight: 700,
            }}
          >
            Create Room
          </button>
          <input
            value={roomIdInput}
            onChange={(event) => setRoomIdInput(event.target.value.toUpperCase())}
            placeholder="ROOM ID"
            style={{
              height: 44,
              border: '1px solid #94a3b8',
              borderRadius: 10,
              padding: '0 12px',
              fontSize: 16,
            }}
          />
          <button
            type="button"
            onClick={() => void joinRoom()}
            disabled={isLoading}
            style={{
              height: 44,
              border: '1px solid #334155',
              background: '#e2e8f0',
              color: '#111827',
              borderRadius: 10,
              cursor: 'pointer',
              fontWeight: 700,
            }}
          >
            Join Room
          </button>
          <button
            type="button"
            onClick={() => void watchRoom()}
            disabled={isLoading}
            style={{
              height: 44,
              border: '1px solid #334155',
              background: '#f8fafc',
              color: '#111827',
              borderRadius: 10,
              cursor: 'pointer',
              fontWeight: 700,
            }}
          >
            Spectate
          </button>
          {error ? <div style={{ color: '#b91c1c', fontSize: 14 }}>{error}</div> : null}
        </div>
      </main>
    );
  }

  const turnLabel = state.currentPlayer === 'B' ? 'Black turn' : 'White turn';
  const winnerLines =
    state.winner !== null
      ? (['B', 'W'] as const).flatMap((player) => {
          const reason = state.winReason[player];
          if (!reason) return [];

          const name = player === 'B' ? 'Black' : 'White';

          if (reason === 'bullets') {
            return [`${name} loses by bullets`];
          }

          if (reason === 'misTensei') {
            return [`${name} loses by misTensei`];
          }

          return [`${name} wins by ${reason}`];
        })
      : previewTerminalWinner === 'B'
      ? ['Black threatens terminal']
      : previewTerminalWinner === 'W'
      ? ['White threatens terminal']
      : previewTerminalWinner === 'BW'
      ? ['Black threatens terminal', 'White threatens terminal']
      : [];
  const phaseLabel = state.reposition
    ? `${state.reposition.player === 'B' ? 'Black' : 'White'} reposition`
    : isMyTurn
    ? 'Highlighted cells are legal slides.'
    : 'Waiting for opponent move.';

  return (
    <main
      style={{
        padding: 24,
        position: 'relative',
        minHeight: '100vh',
        boxSizing: 'border-box',
        background: '#d1d5db',
      }}
    >
      <button
        type="button"
        onClick={() => setShowSidePanels((current) => !current)}
        style={{
          position: 'absolute',
          top: 24,
          left: 24,
          zIndex: 1,
          height: 40,
          padding: '0 14px',
          border: '1px solid #475569',
          borderRadius: 10,
          background: '#f8fafc',
          color: '#111827',
          cursor: 'pointer',
          fontWeight: 700,
        }}
      >
        {showSidePanels ? 'Hide Info' : 'Show Info'}
      </button>
      <div
        style={{
          position: 'absolute',
          top: 24,
          left: 132,
          display: 'flex',
          gap: 8,
          zIndex: 1,
        }}
      >
        <button
          type="button"
          onClick={() => setBoardScale(1)}
          style={{
            height: 40,
            padding: '0 14px',
            border: boardScale === 1 ? '2px solid #0f172a' : '1px solid #475569',
            borderRadius: 10,
            background: '#f8fafc',
            color: '#111827',
            cursor: 'pointer',
            fontWeight: 700,
          }}
        >
          PC
        </button>
        <button
          type="button"
          onClick={() => setBoardScale(0.6)}
          style={{
            height: 40,
            padding: '0 14px',
            border: boardScale === 0.6 ? '2px solid #0f172a' : '1px solid #475569',
            borderRadius: 10,
            background: '#f8fafc',
            color: '#111827',
            cursor: 'pointer',
            fontWeight: 700,
          }}
        >
          Phone
        </button>
      </div>
      {showSidePanels ? (
        <div
          style={{
            position: 'absolute',
            left: 24,
            top: 76,
            minWidth: 220,
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
          }}
        >
          <h1 style={{ margin: 0 }}>Meigeki Tensei Online</h1>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14 }}>
          <div>Room ID: {session.roomId}</div>
          <div>
            You are:{' '}
            {session.player === 'B'
              ? 'Black'
              : session.player === 'W'
              ? 'White'
              : 'Spectator'}
          </div>
          <div>Opponent: {seats?.B && seats?.W ? 'Connected' : 'Waiting'}</div>
          <div>Spectators: {seats?.spectators ?? 0}</div>
        </div>
          {winnerLines.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 10 }}>
              {winnerLines.map((line) => (
                <div key={line} style={{ fontSize: 20, fontWeight: 700 }}>
                  {line}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 10 }}>
              {turnLabel}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14 }}>
            <div>Black bullets left: {bulletsLeftB}</div>
            <div>White bullets left: {bulletsLeftW}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14, marginTop: 4 }}>
            <div>Black score: {scoreB}</div>
            <div>White score: {scoreW}</div>
          </div>
          <div style={{ fontSize: 14, marginTop: 12 }}>
            {phaseLabel}
          </div>
          {error ? <div style={{ color: '#b91c1c', fontSize: 14 }}>{error}</div> : null}
        </div>
      ) : null}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          width: '100%',
          minHeight: 'calc(100vh - 48px)',
        }}
      >
        <Board
          board={displayBoard ?? state.board}
          movable={movable}
          mode={state.reposition ? 'reposition' : 'slide'}
          repositionSource={state.reposition?.from ?? null}
          jumpEmptyB={effectiveJumpEmpty.B}
          jumpEmptyW={effectiveJumpEmpty.W}
          swapAnimation={swapAnimation}
          slideAnimations={slideAnimations}
          animationProgress={animationProgress}
          winHighlightIndices={winHighlightIndices}
          scale={boardScale}
          onCellClick={(index) => {
            if (!isMyTurn || isLoading) return;
            if (!movable.includes(index)) return;
            void submitMove(index);
          }}
        />
      </div>
      {showSidePanels ? (
        <div
          style={{
            position: 'absolute',
            right: 24,
            top: 76,
            width: 240,
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <img
            src="/description.png"
            alt="Game summary"
            style={{
              width: '100%',
              height: 'auto',
              objectFit: 'contain',
            }}
          />
        </div>
      ) : null}
    </main>
  );
}
