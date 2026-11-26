const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: false } });
const PORT = process.env.PORT || 3000;
app.use(express.static("public"));

const rooms = new Map();
const MAX_PLAYERS = 25;
const MIN_PLAYERS = 4;
const START_DELAY = 10;
const GAME_SECONDS = 60 * 60;
const TASKS = [
  ["Pulso de precisión","Mantén una moneda sobre el dorso de la mano durante 10 segundos."],
  ["Memoria exprés","Observa 8 objetos durante 15 segundos y recuerda al menos 6."],
  ["Torre de vasos","Apila 6 vasos y vuelve a desmontarlos en menos de 30 segundos."],
  ["Adivina el sonido","Reconoce 3 sonidos cotidianos."],
  ["Dibujo a ciegas","Dibuja una casa con los ojos cerrados; otra persona debe reconocerla."],
  ["Palabra prohibida","Explica una palabra sin utilizar las 3 palabras prohibidas."],
  ["Puntería de papel","Encesta 3 bolas de papel en una papelera desde una línea marcada."],
  ["Cuenta atrás","Cuenta desde 30 hacia atrás, de tres en tres."],
  ["Mímica relámpago","Representa una película, animal u objeto para que lo adivinen."],
  ["Orden secreto","Ordena 5 cartas por número sin hablar."],
  ["Equilibrio","Mantén un libro ligero sobre la cabeza durante 10 segundos."],
  ["Copia el patrón","Repite una secuencia de 5 palmadas."],
  ["Ojos de detective","Encuentra un objeto entre 8 objetos colocados en una mesa."],
  ["Trabalenguas","Repite dos veces un trabalenguas corto."],
  ["Puzle rápido","Completa un puzle sencillo de 6 a 10 piezas."],
  ["Categorías","Di 5 animales diferentes en 10 segundos."],
  ["Código de colores","Memoriza y repite una secuencia de 5 colores."],
  ["Pasa el objeto","Pasa una pelota utilizando solamente los codos."],
  ["¿Qué ha cambiado?","Detecta un cambio después de cerrar los ojos."],
  ["Palabras encadenadas","Encadena 6 palabras usando la última sílaba anterior."],
  ["Avión de papel","Haz aterrizar un avión de papel en una zona marcada."],
  ["Foto congelada","Imita una postura durante 5 segundos."],
  ["Búsqueda visual","Localiza 5 objetos del color indicado."],
  ["Cálculo mental","Resuelve correctamente 3 sumas sencillas."],
  ["Reto cooperativo","Transportad una pelota sobre una hoja sin que caiga."]
];

// Estas pruebas requieren dos participantes: Orden secreto, Pasa el objeto y Reto cooperativo.
const PAIR_TASKS = [9, 17, 24];
const INDIVIDUAL_TASKS = TASKS.map((_, i) => i).filter(i => !PAIR_TASKS.includes(i));
function shuffled(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function code() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({length:4}, () => alphabet[crypto.randomInt(alphabet.length)]).join("");
}
function cleanName(v) {
  return String(v || "").trim().replace(/[<>]/g, "").slice(0, 18);
}
function publicRoom(room) {
  return {
    code: room.code,
    status: room.status,
    players: [...room.players.values()].map(p => ({
      id: p.id, name: p.name, ready: p.ready, connected: p.connected
    })),
    maxPlayers: MAX_PLAYERS,
    minPlayers: MIN_PLAYERS,
    countdown: room.countdownAt || null,
    endsAt: room.endsAt || null,
    completedTasks: room.completedTasks,
    totalTaskAssignments: room.totalTaskAssignments || 0
  };
}
function broadcast(room) { io.to(room.code).emit("room:update", publicRoom(room)); }
function privateState(room, player) {
  const state = { room: publicRoom(room), me: { id: player.id, name: player.name, ready: player.ready } };
  if (room.status === "playing" || room.status === "finished") {
    state.role = player.role;
    state.mission = player.role === "IMPOSTOR"
      ? "Completa tus sabotajes discretamente y evita revelar tu identidad."
      : "Completa las pruebas y ayuda a descubrir a los impostores.";
    const assigned = player.assignedTasks || [];
    state.game = {
      endsAt: room.endsAt,
      tasks: assigned.map(task => ({
        id: task.id, title: TASKS[task.taskIndex][0], description: TASKS[task.taskIndex][1],
        type: task.type, partnerName: task.partnerId ? room.players.get(task.partnerId)?.name || "Compañero" : null,
        completed: !!task.completed, waitingPartner: !!task.waitingPartner
      })),
      progress: assigned.filter(task => task.completed).length,
      total: assigned.length,
      teamProgress: room.completedTasks || 0,
      teamTotal: room.totalTaskAssignments || 0
    };
  }
  return state;
}
function sendPrivate(room) {
  for (const p of room.players.values()) {
    io.to(p.id).emit("player:state", privateState(room, p));
  }
}
function cancelCountdown(room) {
  if (room.countdownTimer) clearTimeout(room.countdownTimer);
  room.countdownTimer = null;
  room.countdownAt = null;
  if (room.status === "countdown") room.status = "lobby";
}
function maybeStart(room) {
  if (room.status !== "lobby" && room.status !== "countdown") return;
  const players = [...room.players.values()].filter(p => p.connected);
  const allReady = players.length >= MIN_PLAYERS && players.every(p => p.ready);
  if (!allReady) {
    if (room.status === "countdown") cancelCountdown(room);
    broadcast(room);
    return;
  }
  if (room.status === "countdown") return;
  room.status = "countdown";
  room.countdownAt = Date.now() + START_DELAY * 1000;
  broadcast(room);
  room.countdownTimer = setTimeout(() => startGame(room), START_DELAY * 1000);
}
function assignTasks(room, players) {
  room.taskInstances = new Map();
  room.completedTasks = 0;
  room.totalTaskAssignments = players.length * 6;
  for (const player of players) player.assignedTasks = [];

  // Cinco pruebas individuales distintas para cada persona.
  for (const player of players) {
    const selected = shuffled(INDIVIDUAL_TASKS).slice(0, 5);
    for (const taskIndex of selected) {
      player.assignedTasks.push({
        id: crypto.randomUUID(), taskIndex, type: "individual", completed: false
      });
    }
  }

  // La sexta prueba se comparte por parejas. Ambos reciben la misma misión.
  const pairOrder = shuffled(players);
  for (let i = 0; i + 1 < pairOrder.length; i += 2) {
    const first = pairOrder[i];
    const second = pairOrder[i + 1];
    const taskIndex = PAIR_TASKS[crypto.randomInt(PAIR_TASKS.length)];
    const id = crypto.randomUUID();
    const instance = { id, taskIndex, participants: [first.id, second.id], completedBy: new Set() };
    room.taskInstances.set(id, instance);
    first.assignedTasks.push({ id, taskIndex, type: "pair", partnerId: second.id, completed: false });
    second.assignedTasks.push({ id, taskIndex, type: "pair", partnerId: first.id, completed: false });
  }

  // Si queda una persona sin pareja (número impar), recibe una sexta prueba individual.
  if (pairOrder.length % 2) {
    const last = pairOrder[pairOrder.length - 1];
    const already = new Set(last.assignedTasks.map(t => t.taskIndex));
    const extra = shuffled(INDIVIDUAL_TASKS.filter(i => !already.has(i)))[0];
    last.assignedTasks.push({ id: crypto.randomUUID(), taskIndex: extra, type: "individual", completed: false });
  }
  for (const player of players) player.assignedTasks = shuffled(player.assignedTasks);
  room.completedTasks = players.reduce((sum, p) => sum + (p.assignedTasks || []).filter(t => t.completed).length, 0);
}

function startGame(room) {
  const players = [...room.players.values()].filter(p => p.connected);
  if (players.length < MIN_PLAYERS || !players.every(p => p.ready)) {
    room.status = "lobby"; room.countdownAt = null; broadcast(room); return;
  }
  const shuffled = [...players].sort(() => crypto.randomInt(2) ? 1 : -1);
  const impostorCount = Math.max(1, Math.round(players.length / 6));
  shuffled.forEach((p, i) => p.role = i < impostorCount ? "IMPOSTOR" : "TRIPULANTE");
  assignTasks(room, players);
  room.status = "playing";
  room.startedAt = Date.now();
  room.endsAt = room.startedAt + GAME_SECONDS * 1000;
  room.countdownAt = null;
  room.taskIndex = 0;
  room.completedTasks = 0;
  broadcast(room);
  sendPrivate(room);
  room.endTimer = setTimeout(() => {
    room.status = "finished";
    broadcast(room);
    sendPrivate(room);
  }, GAME_SECONDS * 1000);
}

io.on("connection", socket => {
  socket.on("room:create", ({name}, cb = () => {}) => {
    const playerName = cleanName(name);
    if (!playerName) return cb({error:"Escribe tu nombre."});
    let roomCode;
    do { roomCode = code(); } while (rooms.has(roomCode));
    const room = {
      code: roomCode, status:"lobby", players:new Map(),
      countdownTimer:null, endTimer:null, countdownAt:null,
      endsAt:null, taskIndex:0, completedTasks:0
    };
    const player = {id:socket.id, name:playerName, ready:false, connected:true, role:null};
    room.players.set(socket.id, player);
    rooms.set(roomCode, room);
    socket.join(roomCode);
    cb({state:privateState(room, player)});
    broadcast(room);
  });

  socket.on("room:join", ({code:rawCode, name}, cb = () => {}) => {
    const roomCode = String(rawCode || "").trim().toUpperCase();
    const room = rooms.get(roomCode);
    const playerName = cleanName(name);
    if (!room) return cb({error:"No existe esa sala."});
    if (!playerName) return cb({error:"Escribe tu nombre."});
    if (room.status !== "lobby") return cb({error:"La partida ya ha comenzado."});
    if (room.players.size >= MAX_PLAYERS) return cb({error:"La sala está completa."});
    if ([...room.players.values()].some(p => p.name.toLowerCase() === playerName.toLowerCase()))
      return cb({error:"Ese nombre ya está en la sala."});
    const player = {id:socket.id, name:playerName, ready:false, connected:true, role:null};
    room.players.set(socket.id, player);
    socket.join(roomCode);
    cb({state:privateState(room, player)});
    broadcast(room);
  });

  socket.on("player:ready", ({ready}, cb = () => {}) => {
    const room = [...rooms.values()].find(r => r.players.has(socket.id));
    if (!room || room.status !== "lobby") return cb({error:"No se puede cambiar ahora."});
    room.players.get(socket.id).ready = !!ready;
    maybeStart(room);
    sendPrivate(room);
    cb({ok:true});
  });

  socket.on("game:task-complete", ({taskId}, cb = () => {}) => {
    const room = [...rooms.values()].find(r => r.players.has(socket.id));
    if (!room || room.status !== "playing") return cb({error:"La partida no está activa."});
    const player = room.players.get(socket.id);
    const task = (player.assignedTasks || []).find(t => t.id === taskId);
    if (!task) return cb({error:"Esa prueba no está asignada a tu jugador."});
    if (task.completed) return cb({ok:true, alreadyCompleted:true});

    if (task.type === "pair") {
      const instance = room.taskInstances.get(task.id);
      if (!instance || !instance.participants.includes(player.id)) return cb({error:"No se encuentra la pareja de esta prueba."});
      instance.completedBy.add(player.id);
      if (instance.participants.every(id => instance.completedBy.has(id))) {
        for (const participantId of instance.participants) {
          const participant = room.players.get(participantId);
          const matching = participant?.assignedTasks?.find(t => t.id === task.id);
          if (matching) { matching.completed = true; matching.waitingPartner = false; }
        }
      } else {
        task.waitingPartner = true;
      }
    } else {
      task.completed = true;
    }

    room.completedTasks = [...room.players.values()].reduce((sum, p) => sum + (p.assignedTasks || []).filter(t => t.completed).length, 0);
    broadcast(room);
    sendPrivate(room);
    cb({ok:true, completed:task.completed, waitingPartner:!!task.waitingPartner, completedTasks:room.completedTasks});
  });

  socket.on("disconnect", () => {
    for (const room of rooms.values()) {
      const p = room.players.get(socket.id);
      if (!p) continue;
      if (room.status === "lobby" || room.status === "countdown") {
        room.players.delete(socket.id);
        maybeStart(room);
      } else {
        p.connected = false;
        broadcast(room);
      }
      if (room.players.size === 0) {
        if (room.countdownTimer) clearTimeout(room.countdownTimer);
        if (room.endTimer) clearTimeout(room.endTimer);
        rooms.delete(room.code);
      } else {
        broadcast(room);
      }
      break;
    }
  });
});

server.listen(PORT, () => console.log(`Among Fest escuchando en http://localhost:${PORT}`));
