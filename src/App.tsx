import { useEffect, useMemo, useState } from 'react';
import {
  getCellLabel,
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

function getCellImageSrc(cell: Cell) {
  if (cell.imageSrc) {
    return cell.imageSrc;
  }

  switch (cell.type) {
    case 'BP':
      return '/bp.png';
    case 'WP':
      return '/wp.png';
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
}: {
  board: Cell[];
  movable: number[];
  onCellClick: (index: number) => void;
  mode: 'slide' | 'reposition';
  repositionSource: number | null;
  jumpEmptyB: number | null;
  jumpEmptyW: number | null;
  winHighlightIndices: Set<number>;
}) {
  const FULL_SIZE = SIZE + 2;

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
      return <div key={`empty-${x}-${y}`} style={{ width: 72, height: 72 }} />;
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
          width: 72,
          height: 72,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ position: 'relative', width: 32, height: 28 }}>
          <svg
            viewBox="0 0 32 28"
            style={{
              width: 32,
              height: 28,
              transform: `rotate(${rotation}deg)`,
              overflow: 'visible',
            }}
          >
            {(isOppositeB || isOppositeW) && (
              <polygon
                points="16,2 2,26 30,26"
                fill="transparent"
                stroke={isOppositeB ? '#111111' : '#ffffff'}
                strokeWidth="3"
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

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${FULL_SIZE}, 72px)`,
        gap: 6,
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
              onClick={() => onCellClick(boardIndex)}
              style={{
                height: 72,
                border: isSource
                  ? '3px solid #d92d20'
                  : isWinHighlight
                  ? '3px dashed #d92d20'
                  : '1px solid #999',
                background: isMovable
                  ? mode === 'reposition'
                    ? '#b7f5c5'
                    : '#ffe58f'
                  : isWinHighlight
                  ? '#fde7e7'
                  : '#f3f3f3',
                color: '#111',
                cursor: isMovable ? 'pointer' : 'default',
                fontSize: 12,
                lineHeight: 1.3,
                padding: 2,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
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
  const [roomIdInput, setRoomIdInput] = useState('');
  const [session, setSession] = useState<{ roomId: string; player: Player } | null>(null);
  const [seats, setSeats] = useState<{ B: boolean; W: boolean } | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const state = gameState;

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
      seats: { B: boolean; W: boolean };
    }>(`/api/rooms/${nextSession.roomId}`);

    setGameState(data.state);
    setSeats(data.seats);
  }

  useEffect(() => {
    if (!session) return;

    void refreshRoom(session);
    const intervalId = window.setInterval(() => {
      void refreshRoom(session).catch((fetchError: unknown) => {
        setError(fetchError instanceof Error ? fetchError.message : 'Failed to sync room.');
      });
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [session]);

  async function createRoom() {
    setIsLoading(true);
    setError('');

    try {
      const data = await requestJson<{
        roomId: string;
        player: Player;
        state: GameState;
        seats: { B: boolean; W: boolean };
      }>('/api/rooms', {
        method: 'POST',
      });

      setSession({ roomId: data.roomId, player: data.player });
      setGameState(data.state);
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
        player: Player;
        state: GameState;
        seats: { B: boolean; W: boolean };
      }>(`/api/rooms/${normalizedRoomId}/join`, {
        method: 'POST',
      });

      setSession({ roomId: data.roomId, player: data.player });
      setGameState(data.state);
      setSeats(data.seats);
      setRoomIdInput(data.roomId);
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : 'Failed to join room.');
    } finally {
      setIsLoading(false);
    }
  }

  async function submitMove(index: number) {
    if (!session || !gameState) return;

    setIsLoading(true);
    setError('');

    try {
      const data = await requestJson<{
        roomId: string;
        state: GameState;
        seats: { B: boolean; W: boolean };
      }>(`/api/rooms/${session.roomId}/move`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          player: session.player,
          action: gameState.reposition ? 'reposition' : 'slide',
          index,
        }),
      });

      setGameState(data.state);
      setSeats(data.seats);
    } catch (moveError) {
      setError(moveError instanceof Error ? moveError.message : 'Failed to submit move.');
    } finally {
      setIsLoading(false);
    }
  }

  const bulletsLeftB = state ? 6 - state.bulletsUsed.B : 6;
  const bulletsLeftW = state ? 6 - state.bulletsUsed.W : 6;
  const scoreB = state?.score.B ?? 0;
  const scoreW = state?.score.W ?? 0;
  const blockedIndices = useMemo(
    () => (state ? getTriangleBlockedIndices(state.jumpEmpty) : []),
    [state],
  );
  const isMyTurn =
    !!state &&
    !!session &&
    (state.reposition
      ? state.reposition.player === session.player
      : state.currentPlayer === session.player);

  const movable = useMemo(
    () =>
      !state || state.winner || !isMyTurn
        ? []
        : state.reposition
        ? getRepositionIndices(state.board, state.reposition.player)
        : getMovableIndices(state.board, state.turnRotation).filter(
            (index) => !blockedIndices.includes(index) || index === state.turnStartEmpty,
          ),
    [
      blockedIndices,
      isMyTurn,
      state,
    ],
  );

  const previewTerminalWinner = useMemo(
    () => (state && !state.winner && !state.reposition ? getWinner(state.board) : null),
    [state],
  );

  const winHighlightIndices = useMemo(() => {
    if (!state) {
      return new Set<number>();
    }

    if (state.winHighlightIndices.length > 0) {
      return new Set(state.winHighlightIndices);
    }

    if (previewTerminalWinner === 'B') {
      return new Set(getTerminalHighlightIndices(state.board, 'B'));
    }

    if (previewTerminalWinner === 'W') {
      return new Set(getTerminalHighlightIndices(state.board, 'W'));
    }

    if (previewTerminalWinner === 'BW') {
      return new Set([
        ...getTerminalHighlightIndices(state.board, 'B'),
        ...getTerminalHighlightIndices(state.board, 'W'),
      ]);
    }

    return new Set<number>();
  }, [previewTerminalWinner, state]);

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
            Create a room as Black, or join an existing room as White.
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
      <div
        style={{
          position: 'absolute',
          left: 24,
          top: 24,
          minWidth: 220,
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
        }}
      >
        <h1 style={{ margin: 0 }}>Meigeki Tensei Online</h1>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14 }}>
          <div>Room ID: {session.roomId}</div>
          <div>You are: {session.player === 'B' ? 'Black' : 'White'}</div>
          <div>Opponent: {seats?.B && seats?.W ? 'Connected' : 'Waiting'}</div>
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
          board={state.board}
          movable={movable}
          mode={state.reposition ? 'reposition' : 'slide'}
          repositionSource={state.reposition?.from ?? null}
          jumpEmptyB={state.jumpEmpty.B}
          jumpEmptyW={state.jumpEmpty.W}
          winHighlightIndices={winHighlightIndices}
          onCellClick={(index) => {
            if (!isMyTurn || isLoading) return;
            void submitMove(index);
          }}
        />
      </div>
      <div
        style={{
          position: 'absolute',
          right: 24,
          top: 24,
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
    </main>
  );
}
