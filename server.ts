import { createServer } from 'node:http';
import {
  applyReposition,
  applySlide,
  createInitialGameState,
  type GameState,
  type Player,
} from './src/game.ts';

type Participant = Player | 'S';

type Room = {
  id: string;
  state: GameState;
  seats: {
    B: boolean;
    W: boolean;
    spectators: number;
  };
  updatedAt: number;
};

type ApiResponse =
  | {
      roomId: string;
      player: Participant;
      state: GameState;
      seats: Room['seats'];
    }
  | {
      roomId: string;
      state: GameState;
      seats: Room['seats'];
    }
  | {
      status: 'ok';
    }
  | {
      error: string;
    };

const PORT = Number(process.env.PORT ?? 8787);
const rooms = new Map<string, Room>();

function createRoomId() {
  let roomId = '';

  do {
    roomId = Math.random().toString(36).slice(2, 8).toUpperCase();
  } while (rooms.has(roomId));

  return roomId;
}

function json(data: ApiResponse, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

async function parseBody(request: Request) {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function getRoom(roomId: string) {
  return rooms.get(roomId.toUpperCase()) ?? null;
}

function roomPayload(room: Room) {
  return {
    roomId: room.id,
    state: room.state,
    seats: room.seats,
  };
}

function applyCors(res: import('node:http').ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

const server = createServer(async (req, res) => {
  applyCors(res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  const request = new Request(url, {
    method: req.method,
    headers: req.headers as Record<string, string>,
    body:
      req.method === 'GET' || req.method === 'HEAD'
        ? undefined
        : req,
    duplex: 'half',
  });

  let response: Response;

  if (request.method === 'GET' && url.pathname === '/api/health') {
    response = json({ status: 'ok' }, 200);
  } else if (request.method === 'POST' && url.pathname === '/api/rooms') {
    const roomId = createRoomId();
    const room: Room = {
      id: roomId,
      state: createInitialGameState(),
      seats: {
        B: true,
        W: false,
        spectators: 0,
      },
      updatedAt: Date.now(),
    };

    rooms.set(roomId, room);
    response = json({
      roomId,
      player: 'B',
      state: room.state,
      seats: room.seats,
    });
  } else if (request.method === 'POST' && /^\/api\/rooms\/[^/]+\/join$/.test(url.pathname)) {
    const roomId = url.pathname.split('/')[3] ?? '';
    const room = getRoom(roomId);

    if (!room) {
      response = json({ error: 'Room not found.' }, 404);
    } else if (room.seats.W) {
      response = json({ error: 'Room is already full.' }, 409);
    } else {
      room.seats.W = true;
      room.updatedAt = Date.now();
      response = json({
        roomId: room.id,
        player: 'W',
        state: room.state,
        seats: room.seats,
      });
    }
  } else if (request.method === 'POST' && /^\/api\/rooms\/[^/]+\/watch$/.test(url.pathname)) {
    const roomId = url.pathname.split('/')[3] ?? '';
    const room = getRoom(roomId);

    if (!room) {
      response = json({ error: 'Room not found.' }, 404);
    } else {
      room.seats.spectators += 1;
      room.updatedAt = Date.now();
      response = json({
        roomId: room.id,
        player: 'S',
        state: room.state,
        seats: room.seats,
      });
    }
  } else if (request.method === 'GET' && /^\/api\/rooms\/[^/]+$/.test(url.pathname)) {
    const roomId = url.pathname.split('/')[3] ?? '';
    const room = getRoom(roomId);

    response = room
      ? json(roomPayload(room))
      : json({ error: 'Room not found.' }, 404);
  } else if (request.method === 'POST' && /^\/api\/rooms\/[^/]+\/move$/.test(url.pathname)) {
    const roomId = url.pathname.split('/')[3] ?? '';
    const room = getRoom(roomId);

    if (!room) {
      response = json({ error: 'Room not found.' }, 404);
    } else {
      const body = await parseBody(request);
      const player = body.player;
      const action = body.action;
      const index = body.index;

      if ((player !== 'B' && player !== 'W') || typeof index !== 'number') {
        response = json({ error: 'Invalid move payload.' }, 400);
      } else if (player !== room.state.currentPlayer && !room.state.reposition) {
        response = json({ error: 'It is not your turn.' }, 409);
      } else if (room.state.reposition && room.state.reposition.player !== player) {
        response = json({ error: 'Only the reposition player can act now.' }, 409);
      } else {
        const nextState =
          action === 'reposition'
            ? applyReposition(room.state, index)
            : action === 'slide'
            ? applySlide(room.state, index)
            : null;

        if (!nextState) {
          response = json({ error: 'Illegal move.' }, 409);
        } else {
          room.state = nextState;
          room.updatedAt = Date.now();
          response = json(roomPayload(room));
        }
      }
    }
  } else {
    response = json({ error: 'Not found.' }, 404);
  }

  res.statusCode = response.status;
  response.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });
  const buffer = Buffer.from(await response.arrayBuffer());
  res.end(buffer);
});

server.listen(PORT, () => {
  console.log(`Game server running at http://localhost:${PORT}`);
});
