const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: false }, maxHttpBufferSize: 2e6 });
const PORT = process.env.PORT || 3000;
app.use(express.static('public'));

const rooms = new Map();
const MAX_PLAYERS = 25, MIN_PLAYERS = 4, START_DELAY = 10, APP_VERSION = '2.2';
const CARD_TOKENS = ["AF25-b7yTu5IubInvXF7o", "AF25-Ko-onXPBUdwkvJS7", "AF25-GUYR_AnGGPRLR4nk", "AF25-85VQMP_ZZrRor_dT", "AF25-YDQXFEt_vqcERnyW", "AF25-P3m3H3aWChvfbBG_", "AF25-_6XWBMMgCDWCJxW7", "AF25-iuZuE3nkA1fNx1A2", "AF25-yR-KKiMd84mqLxVl", "AF25-NylZgwqkiR0Hlmw5", "AF25-FCwCNSclGvFzZjkT", "AF25-wNnsw44YtlB74hvM", "AF25-sQKVC-5j010iBdNN", "AF25-sA7UI8kuJE5clDc3", "AF25-K751bCImxxZ4-ATq", "AF25-F-pnn6O_lvEvgnwT", "AF25-4Unotgwi9PEF1gTO", "AF25-HpBO-HSgfqxWAuUm", "AF25-bRcULYtrmRgf1wDp", "AF25-n_WX8DgCbef6c1s0", "AF25-KVzQaKQgeFDyw3qa", "AF25-pc9meYYQtmqe6rAG", "AF25-ZDswzdPniVaNmBYf", "AF25-lV4q09xnTYhwTQf6", "AF25-7SI_GrLHrHG9hSMD"];
const CARD_NUMBER_BY_TOKEN = new Map(CARD_TOKENS.map((token,index)=>[token,index+1]));

const DEFAULT_CONFIG = Object.freeze({durationMinutes:60,impostorMode:'auto',impostorCount:1,debateMinutes:3,individualPerPlayer:2,missionTypes:{pair:true,individual:true,special:true}});

const MISSIONS = [
  { id:1, title:'Torre compartida', type:'pair', description:'Entre los dos participantes tendréis que construir una torre de seis vasos. La misión se completa cuando la torre se mantiene en pie.', materials:'6 vasos de plástico.' },
  { id:2, title:'Dibujo a dúo', type:'pair', description:'Un participante tendrá que describir una imagen sin enseñarla. El otro deberá dibujarla siguiendo sus indicaciones.', materials:'Papel, lápiz y una imagen de su móvil.' },
  { id:3, title:'Globo compartido', type:'pair', description:'Entre los dos tendréis que mantener un globo en el aire y conseguir darle diez toques sin que caiga al suelo.', materials:'1 globo.' },
  { id:4, title:'Palabras encadenadas', type:'pair', description:'Tendréis que decir ocho palabras encadenadas. Cada palabra debe comenzar por la última letra de la palabra anterior.', materials:'Ninguno.' },
  { id:5, title:'Pasa la pelota', type:'pair', description:'Tendréis que pasaros una pelota utilizando únicamente los codos, sin sujetarla con las manos.', materials:'1 pelota.' },
  { id:6, title:'El combo perfecto', type:'pair', description:'Un participante realizará una secuencia de seis movimientos como si estuviera pulsando los botones de un mando de PlayStation. El otro tendrá que imitar exactamente la secuencia. Solo hay una ronda y no se intercambian los papeles.', materials:'Ninguno.' },
  { id:7, title:'Orden secreto', type:'pair', description:'Tendréis que ordenar cinco cartas de la baraja para conseguir la combinación correcta que aparecerá en la pantalla de la aplicación.', materials:'Una baraja de cartas.' },
  { id:8, title:'Adivina la canción', type:'pair', description:'Uno de los participantes pondrá una canción y el otro tendrá que adivinar cuál es. La prueba no se completa hasta que adivine la canción.', materials:'Móvil.' },
  { id:9, title:'Construcción a ciegas', type:'pair', description:'Un participante tendrá que describir una figura sin enseñarla. El otro deberá intentar construirla con plastilina siguiendo las instrucciones.', materials:'Plastilina.' },
  { id:10, title:'Pelota al objetivo', type:'pair', description:'Por turnos, tendréis que lanzar una pelota e intentar conseguir tres aciertos en el objetivo.', materials:'Pelota y cubo o recipiente.' },
  { id:11, title:'Cuenta conjunta', type:'pair', description:'Tendréis que contar alternativamente desde el 1 hasta el 20. No podéis hablar a la vez ni equivocaros.', materials:'Ninguno.' },
  { id:13, title:'Puntería', type:'individual', description:'Tendrás que hacer tres bolas de papel e intentar encestarlas en una papelera.', materials:'Papel y papelera.' },
  { id:15, title:'Chupito loco', type:'individual', description:'Tendrás que elegir una bebida «sin alcohol» y tomar un vasito. También puedes escoger un refresco o agua.', materials:'Vasitos y bebida «sin alcohol».' },
  { id:16, title:'Invita al compañero', type:'individual', description:'Tendrás que preparar un vasito de una bebida «sin alcohol» y ofrecérselo a alguien. La otra persona puede aceptar o rechazarlo.', materials:'Vasos y bebida «sin alcohol».' },
  { id:17, title:'El show es tuyo', type:'individual', description:'Tendrás que elegir una canción y montar tu propio espectáculo. Debes cantar o bailar durante al menos 30 segundos.', materials:'Móvil y altavoz.' },
  { id:18, title:'Baile privado', type:'individual', description:'Tendrás que elegir a otro participante y dedicarle un baile de 30 segundos. La otra persona debe aceptar participar.', materials:'Móvil y altavoz.' },
  { id:19, title:'El tacón de Jason', type:'special', description:'«Jason tiene un problema gordo: ha perdido un tacón y necesita recuperarlo antes de que Lucía se entere. La última vez que estuvieron juntos acabaron tirándose a la piscina y Jason salió de allí sin el tacón. Tu misión es encontrarlo y salvarlo de una buena bronca. ¡Que Lucía no descubra lo ocurrido!» HAZLE UNA FOTO Y TENLA COMO PRUEBA', materials:'Un tacón o zapato.', assignment:'20 % del sorteo de misiones especiales.', preparation:'Los organizadores dejarán el tacón escondido en una zona accesible, fuera del agua.', photoRequired:true },
  { id:20, title:'El «cubata» secreto', type:'special', description:'«Has recibido un encargo especial. Debes preparar un «cubata» con una combinación de refrescos y algún toque especial, siempre «sin alcohol». Después tendrás que entregárselo a la persona que quieras.»', materials:'Vasos, refrescos e ingredientes «sin alcohol».', assignment:'20 % del sorteo de misiones especiales.' },
  { id:21, title:'Lucía se queda sin comer', type:'special', description:'«¡Lucía se ha quedado sin comida y necesita provisiones urgentemente! Coge el tenedor de plástico que encontrarás encima de un plato en la encimera. Busca a alguien que esté comiendo y representad una escena teatral de atraco al más puro estilo GTA VI. La otra persona debe aceptar participar y ofrecerte voluntariamente algo de comida».', materials:'Un tenedor de plástico y un plato.', assignment:'20 % del sorteo de misiones especiales.', preparation:'Dejar el tenedor encima del plato en la encimera. La escena será una actuación acordada y la comida se ofrecerá voluntariamente.' },
  { id:22, title:'El encargo de Paula', type:'special', description:'«Tienes un encargo exclusivo: preparar para Paula una bebida especial con Pepsi-Cola, al estilo de un combinado «sin alcohol». Debes preparársela y entregársela sin revelar que estás cumpliendo una misión».', materials:'Pepsi-Cola, vasos e hielo. La versión de esta misión incluida aquí es «sin alcohol».', assignment:'20 % del sorteo de misiones especiales.' },
  { id:23, title:'Que te quedas sin comeh', type:'special', description:'Debes conseguir que otra persona coma algo de lo que le ofrezcas. La prueba se completa cuando acepta y come voluntariamente. Aquí nadie se queda sin comeh.', materials:'Comida.', assignment:'20 % del sorteo de misiones especiales.' }
];
const BY_ID = new Map(MISSIONS.map(m => [m.id,m]));
const PAIR_IDS = [1,2,3,4,5,6,7,8,9,10,11];
const INDIVIDUAL_IDS = [13,15,16,17,18];
const SPECIAL_IDS = [19,20,21,22,23];
const IMAGE_CARDS = [
  {emoji:'🐈 📦',caption:'Un gato sentado sobre una caja'}, {emoji:'🚀 🌙',caption:'Un cohete junto a la luna'},
  {emoji:'🏰 ⭐',caption:'Un castillo con una estrella'}, {emoji:'🚲 🌳',caption:'Una bicicleta junto a un árbol'},
  {emoji:'🐠 🌊',caption:'Un pez entre dos algas'}, {emoji:'☂️ 🌧️',caption:'Un paraguas bajo la lluvia'},
  {emoji:'🍎 📚',caption:'Una manzana encima de unos libros'}
];
const REPORT_WORDS = ['GALAXIA','COMETA','NEBULOSA','ASTEROIDE','SATURNO'];
const pick = a => a[crypto.randomInt(a.length)];
function shuffle(a) { const b=[...a]; for(let i=b.length-1;i>0;i--){const j=crypto.randomInt(i+1);[b[i],b[j]]=[b[j],b[i]];} return b; }
function roomCode(){const a='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';return Array.from({length:4},()=>a[crypto.randomInt(a.length)]).join('');}
function cleanName(v){return String(v||'').trim().replace(/[<>]/g,'').slice(0,18);}
function living(room){return [...room.players.values()].filter(p=>p.alive);}
function connectedLiving(room){return living(room).filter(p=>p.connected);}
function mission(id){return BY_ID.get(id);}
function cleanMissionHistory(value){if(!Array.isArray(value))return [];return value.map(Number).filter(id=>BY_ID.has(id)).slice(0,60);}
function cleanConfig(input={},playerCount=MIN_PLAYERS){
  const c={...DEFAULT_CONFIG,...(input||{})};
  c.durationMinutes=[30,45,60].includes(Number(c.durationMinutes))?Number(c.durationMinutes):60;
  c.debateMinutes=[2,3,4].includes(Number(c.debateMinutes))?Number(c.debateMinutes):3;
  c.impostorMode=c.impostorMode==='custom'?'custom':'auto';
  c.impostorCount=Math.max(1,Math.min(Math.max(1,Math.floor((playerCount-1)/2)),5,Number(c.impostorCount)||1));
  c.individualPerPlayer=Math.max(1,Math.min(3,Number(c.individualPerPlayer)||2));
  const mt=c.missionTypes||{};
  c.missionTypes={pair:mt.pair!==false,individual:mt.individual!==false,special:mt.special!==false};
  if(!Object.values(c.missionTypes).some(Boolean))throw new Error('Activa al menos un tipo de misión.');
  if(c.missionTypes.pair&&!c.missionTypes.individual&&!c.missionTypes.special&&playerCount%2)throw new Error('Con solo misiones por parejas necesitas un número par de jugadores.');
  return c;
}
function notifyRoom(room,title,message,type='info'){
  io.to(room.code).emit('app:notification',{title,message,type,at:Date.now()});
}
function remapPlayerReferences(room,oldId,newId){
  for(const inst of (room.taskInstances||new Map()).values()){
    inst.participants=(inst.participants||[]).map(id=>id===oldId?newId:id);
    if(inst.completedBy?.has(oldId)){inst.completedBy.delete(oldId);inst.completedBy.add(newId);}
    if(inst.describerId===oldId)inst.describerId=newId;
  }
  for(const player of room.players.values())for(const task of (player.assignedTasks||[]))if(task.partnerId===oldId)task.partnerId=newId;
  if(room.meeting){
    if(room.meeting.reporterId===oldId)room.meeting.reporterId=newId;
    if(room.meeting.bodyPlayerId===oldId)room.meeting.bodyPlayerId=newId;
    if(room.meeting.votes?.has(oldId)){const vote=room.meeting.votes.get(oldId);room.meeting.votes.delete(oldId);room.meeting.votes.set(newId,vote);}
  }
  for(const [number,id] of (room.cardAssignments||new Map()).entries())if(id===oldId)room.cardAssignments.set(number,newId);
  if(room.hostId===oldId)room.hostId=newId;
  for(const request of (room.eliminationRequests||new Map()).values()){
    if(request.killerId===oldId)request.killerId=newId;
    if(request.targetId===oldId)request.targetId=newId;
  }
}
function playerGameStats(room,player){
  const tasks=player.assignedTasks||[];
  return {id:player.id,name:player.name,role:player.role,alive:!!player.alive,ejected:!!player.ejected,
    missionsCompleted:tasks.filter(t=>t.completed).length,missionsTotal:tasks.length,
    eliminations:player.eliminations||0,votesCast:player.votesCast||0};
}
function buildGameStats(room,winner,reason){
  const now=Date.now(),durationSeconds=room.startedAt?Math.max(0,Math.floor((now-room.startedAt)/1000)):0;
  const playerStats=[...room.players.values()].map(p=>playerGameStats(room,p)).sort((a,b)=>b.missionsCompleted-a.missionsCompleted||b.eliminations-a.eliminations);
  return {gameNumber:(room.history?.length||0)+1,finishedAt:now,durationSeconds,winner,reason,
    totalMissions:room.totalTaskAssignments||0,completedMissions:room.completedTasks||0,
    meetings:room.meetingCount||0,totalVotes:room.totalVotes||0,
    ejections:playerStats.filter(p=>p.ejected).length,playerStats};
}
function fairMission(pool,players){
  const histories=players.map(p=>p.missionHistory||[]);
  const scores=pool.map(id=>({id,score:histories.reduce((sum,h)=>{const at=h.indexOf(id);return sum+(at<0?0:1/(at+1));},0)}));
  const best=Math.min(...scores.map(x=>x.score));
  return pick(scores.filter(x=>x.score===best).map(x=>x.id));
}
function fairMissions(pool,player,count){
  const available=[...pool],chosen=[];
  while(available.length&&chosen.length<count){const id=fairMission(available,[player]);chosen.push(id);available.splice(available.indexOf(id),1);}
  return chosen;
}
function taskRecords(room){
  const records=new Map();
  for(const p of room.players.values())for(const t of (p.assignedTasks||[]))if(!records.has(t.id)||t.completed)records.set(t.id,t);
  for(const t of (room.survivalTasks||[]))if(!records.has(t.id)||t.completed)records.set(t.id,t);
  return [...records.values()];
}
function completedCount(room){return taskRecords(room).filter(t=>t.completed).length;}
function transferPendingTasksToSurvival(room,player){
  room.survivalTasks=room.survivalTasks||[];
  for(const task of (player.assignedTasks||[]).filter(t=>!t.completed)){
    if(task.type==='pair'){
      const partner=room.players.get(task.partnerId),instance=room.taskInstances?.get(task.id);
      if(partner?.alive&&living(room).length>1){
        if(instance){instance.completedBy=new Set();if(instance.missionId===2&&!room.players.get(instance.describerId)?.alive)instance.describerId=partner.id;}
        const partnerTask=partner.assignedTasks?.find(x=>x.id===task.id);if(partnerTask)partnerTask.waitingPartner=false;
        continue;
      }
      if(instance&&instance.missionId===2&&!room.players.get(instance.describerId)?.alive){const alive=living(room);if(alive.length)instance.describerId=pick(alive.map(x=>x.id));}
    }
    if(room.survivalTasks.some(x=>x.id===task.id))continue;
    room.survivalTasks.push({...task,type:'survival',completed:false,waitingPartner:false,partnerId:null,sourcePlayerName:player.name});
    for(const q of room.players.values())q.assignedTasks=(q.assignedTasks||[]).filter(x=>x.id!==task.id);
  }
  room.totalTaskAssignments=taskRecords(room).length;room.completedTasks=completedCount(room);
}
function serializeTask(room,player,t,shared=false){
  const m=mission(t.missionId),instance=room.taskInstances?.get(t.id),partner=t.partnerId?room.players.get(t.partnerId):null;
  return {
    id:t.id,missionId:t.missionId,title:m.title,description:m.description,materials:m.materials,type:shared?'survival':t.type,
    assignment:m.assignment||null,preparation:m.preparation||null,partnerName:partner?.name||'Compañero',
    partnerEliminated:!!(!shared&&t.type==='pair'&&t.partnerId&&!partner?.alive),
    partnerOptions:!shared&&t.type==='pair'?living(room).filter(x=>x.id!==player.id).map(x=>({id:x.id,name:x.name})):[],
    sourcePlayerName:shared?(t.sourcePlayerName||'un jugador eliminado'):null,shared,
    completed:!!t.completed,waitingPartner:!!t.waitingPartner,photoRequired:!!m.photoRequired,photoProof:t.photoProof||null,
    combo:t.combo||instance?.combo||null,imageCard:instance?.describerId===player.id?instance.imageCard:null,
    imageHolderName:t.missionId===2?(room.players.get(instance?.describerId)?.name||'un superviviente'):null
  };
}
function publicRoom(room){return {
  code:room.code,status:room.status,pausedFromStatus:room.pausedFromStatus||null,version:APP_VERSION,config:room.config,
  players:[...room.players.values()].map(p=>({id:p.id,name:p.name,photo:p.photo||null,cardNumber:p.cardNumber,ready:p.ready,connected:p.connected,alive:!!p.alive,ejected:!!p.ejected,discovered:!!p.discovered,isHost:p.id===room.hostId})),
  maxPlayers:MAX_PLAYERS,minPlayers:MIN_PLAYERS,countdown:room.countdownAt||null,endsAt:room.endsAt||null,
  completedTasks:room.completedTasks||0,totalTaskAssignments:room.totalTaskAssignments||0,
  meeting:room.meeting?{reporterName:room.players.get(room.meeting.reporterId)?.name||'Jugador',foundPlayerName:room.players.get(room.meeting.bodyPlayerId)?.name||'Jugador',phase:room.meeting.phase,discussionEndsAt:room.meeting.discussionEndsAt,votesCast:room.meeting.votes.size,votesNeeded:connectedLiving(room).length}:null,
  lastMeetingResult:room.lastMeetingResult||null,winner:room.winner||null,finishReason:room.finishReason||null,
  stats:room.status==='finished'?(room.lastStats||null):null,history:(room.history||[]).slice(-10)
};}
function privateState(room,p){
  const pending=[...(room.eliminationRequests||new Map()).entries()].find(([,request])=>request.targetId===p.id&&request.expiresAt>Date.now());
  const s={room:publicRoom(room),me:{id:p.id,name:p.name,ready:p.ready,alive:p.alive,isHost:p.id===room.hostId},session:{code:room.code,token:p.sessionToken},pendingEliminationId:pending?.[0]||null};
  if(['playing','meeting','paused','finished'].includes(room.status)){
    const tasks=p.alive?(p.assignedTasks||[]).map(t=>serializeTask(room,p,t,false)):[];
    const survivalTasks=p.alive?(room.survivalTasks||[]).map(t=>serializeTask(room,p,t,true)):[];
    s.role=p.role;s.mission=p.role==='IMPOSTOR'?'Tienes misiones como el resto. Completa las pruebas sin revelar tu identidad.':'Completa tus misiones y ayuda a descubrir a los impostores.';
    s.game={endsAt:room.endsAt,tasks,survivalTasks,progress:tasks.filter(t=>t.completed).length,total:tasks.length,teamProgress:room.completedTasks||0,teamTotal:room.totalTaskAssignments||0,
      isAlive:p.alive,isHost:p.id===room.hostId,reportCode:p.alive?room.reportCode:null,
      players:[...room.players.values()].map(x=>({id:x.id,name:x.name,photo:x.photo||null,cardNumber:x.cardNumber})),
      eliminationTargets:p.role==='IMPOSTOR'&&p.alive&&room.status==='playing'?living(room).filter(x=>x.id!==p.id).map(x=>({id:x.id,name:x.name,photo:x.photo||null,cardNumber:x.cardNumber})):[],
      voteOptions:room.status==='meeting'&&room.meeting?.phase==='voting'&&p.alive?connectedLiving(room).map(x=>({id:x.id,name:x.name})):[],
      hasVoted:!!(room.meeting&&room.meeting.votes.has(p.id)),meetingResult:room.lastMeetingResult||null,
      paused:room.status==='paused',pausedFromStatus:room.pausedFromStatus||null,stats:room.lastStats||null,hostIssues:p.id===room.hostId?(room.issues||[]).filter(issue=>issue.status==='open'):[]
    };
  }
  return s;
}
function sendPrivate(room){for(const p of room.players.values())io.to(p.id).emit('player:state',privateState(room,p));}
function sendOne(room,p){io.to(p.id).emit('player:state',privateState(room,p));}
function broadcast(room){io.to(room.code).emit('room:update',publicRoom(room));}
function findRoom(id){for(const r of rooms.values())if(r.players.has(id))return r;return null;}
function cancelCountdown(r){if(r.countdownTimer)clearTimeout(r.countdownTimer);r.countdownTimer=null;r.countdownAt=null;if(r.status==='countdown')r.status='lobby';}
function maybeStart(r){if(!['lobby','countdown'].includes(r.status))return;const ps=[...r.players.values()].filter(p=>p.connected);const ready=ps.length>=MIN_PLAYERS&&ps.every(p=>p.ready);if(!ready){if(r.status==='countdown')cancelCountdown(r);broadcast(r);return;}if(r.status==='countdown')return;r.status='countdown';r.countdownAt=Date.now()+START_DELAY*1000;broadcast(r);r.countdownTimer=setTimeout(()=>startGame(r),START_DELAY*1000);}
function combo(){const suits=[['♥',true],['♦',true],['♣',false],['♠',false]],ranks=['A','2','3','4','5','6','7','8','9','10','J','Q','K'];return shuffle(suits.flatMap(s=>ranks.map(v=>({rank:v,suit:s[0],red:s[1]})))).slice(0,5);}
function assignTasks(r,ps){
  r.taskInstances=new Map();r.survivalTasks=[];r.completedTasks=0;r.totalTaskAssignments=0;
  const config=cleanConfig(r.config,ps.length),types=config.missionTypes;
  for(const p of ps){
    p.assignedTasks=[];
    if(types.individual)for(const id of fairMissions(INDIVIDUAL_IDS,p,config.individualPerPlayer))p.assignedTasks.push({id:crypto.randomUUID(),missionId:id,type:'individual',completed:false});
  }
  const order=shuffle(ps);
  if(types.pair){
    for(let i=0;i+1<order.length;i+=2){
      const a=order[i],b=order[i+1],id=fairMission(PAIR_IDS,[a,b]),taskId=crypto.randomUUID();
      const inst={id:taskId,missionId:id,participants:[a.id,b.id],completedBy:new Set()};
      if(id===7)inst.combo=combo();
      if(id===2){inst.imageCard=pick(IMAGE_CARDS);inst.describerId=pick([a.id,b.id]);}
      r.taskInstances.set(taskId,inst);
      const base={id:taskId,missionId:id,type:'pair',completed:false};
      a.assignedTasks.push({...base,partnerId:b.id,combo:inst.combo||null,isDescriber:inst.describerId===a.id,imageCard:inst.describerId===a.id?inst.imageCard:null});
      b.assignedTasks.push({...base,partnerId:a.id,combo:inst.combo||null,isDescriber:inst.describerId===b.id,imageCard:inst.describerId===b.id?inst.imageCard:null});
    }
  }
  if(types.individual&&order.length%2){
    const last=order[order.length-1],used=new Set(last.assignedTasks.map(t=>t.missionId));
    const extra=fairMission(INDIVIDUAL_IDS.filter(id=>!used.has(id)),[last]);
    last.assignedTasks.push({id:crypto.randomUUID(),missionId:extra,type:'individual',completed:false});
  }
  if(types.special)for(const player of ps){
    const special=fairMission(SPECIAL_IDS,[player]);
    player.assignedTasks.push({id:crypto.randomUUID(),missionId:special,type:'special',completed:false});
  }
  for(const player of ps){player.assignedTasks=shuffle(player.assignedTasks);player.eliminations=0;player.votesCast=0;player.ejected=false;player.discovered=false;player.alive=true;}
  r.totalTaskAssignments=taskRecords(r).length;r.completedTasks=completedCount(r);
}
function finishGame(r,winner,reason){
  if(r.status==='finished')return;
  const stats=buildGameStats(r,winner,reason);
  r.status='finished';r.winner=winner;r.finishReason=reason;r.meeting=null;
  r.lastStats=stats;r.history=r.history||[];r.history.push(stats);r.history=r.history.slice(-10);
  if(r.meetingTimer)clearTimeout(r.meetingTimer);r.meetingTimer=null;
  if(r.endTimer)clearTimeout(r.endTimer);r.endTimer=null;
  if(r.eliminationRequests)r.eliminationRequests.clear();
  notifyRoom(r,winner==='TRIPULANTES'?'¡Victoria de los tripulantes!':winner==='IMPOSTORES'?'¡Victoria de los impostores!':'Partida finalizada',reason==='all_tasks_completed'?'Se han completado todas las misiones.':reason==='all_impostors_eliminated'?'Todos los impostores han sido expulsados o eliminados.':reason==='impostors_reached_parity'?'Los impostores han alcanzado la paridad.':'La partida ha terminado.','success');
}
function checkGameWinner(r){
  if(r.status==='finished')return true;
  if(r.totalTaskAssignments>0&&r.completedTasks>=r.totalTaskAssignments){finishGame(r,'TRIPULANTES','all_tasks_completed');return true;}
  const alive=living(r),impostors=alive.filter(p=>p.role==='IMPOSTOR').length,crew=alive.filter(p=>p.role!=='IMPOSTOR').length;
  if(impostors===0){finishGame(r,'TRIPULANTES','all_impostors_eliminated');return true;}
  if(impostors>=crew){finishGame(r,'IMPOSTORES','impostors_reached_parity');return true;}
  return false;
}
function startGame(r){
  const ps=[...r.players.values()].filter(p=>p.connected);
  if(ps.length<MIN_PLAYERS||!ps.every(p=>p.ready)){r.status='lobby';r.countdownAt=null;broadcast(r);return;}
  for(const [id,p] of r.players)if(!p.connected)r.players.delete(id);
  const roles=shuffle(ps),config=cleanConfig(r.config,ps.length),n=config.impostorMode==='custom'?Math.max(1,Math.min(Math.max(1,Math.floor((ps.length-1)/2)),config.impostorCount)):Math.max(1,Math.round(ps.length/6));
  r.config=config;roles.forEach((p,i)=>{p.role=i<n?'IMPOSTOR':'TRIPULANTE';p.alive=true;});
  assignTasks(r,ps);r.status='playing';r.startedAt=Date.now();r.endsAt=r.startedAt+config.durationMinutes*60*1000;r.countdownAt=null;r.reportCode=null;r.meeting=null;r.lastMeetingResult=null;r.winner=null;r.finishReason=null;r.lastStats=null;r.meetingCount=0;r.totalVotes=0;r.eliminationRequests=new Map();
  broadcast(r);sendPrivate(r);notifyRoom(r,'¡La partida ha comenzado!','Se han repartido los roles y las misiones.','success');
  r.endTimer=setTimeout(()=>{finishGame(r,null,'time_limit');broadcast(r);sendPrivate(r);},config.durationMinutes*60*1000);
}
function beginMeetingVoting(r){if(!r.meeting||r.meeting.phase!=='discussion'||r.status==='paused')return;if(r.meetingTimer)clearTimeout(r.meetingTimer);r.meetingTimer=null;r.meeting.phase='voting';broadcast(r);sendPrivate(r);notifyRoom(r,'¡Votación abierta!','El debate ha terminado. Ya podéis votar.','meeting');}
function resolveMeeting(r){
  if(r.status==='paused'||!r.meeting||r.meeting.phase!=='voting')return;
  if(r.meetingTimer)clearTimeout(r.meetingTimer);r.meetingTimer=null;
  const eligible=connectedLiving(r);if(!eligible.every(p=>r.meeting.votes.has(p.id)))return;
  const counts=new Map();for(const v of r.meeting.votes.values())counts.set(v,(counts.get(v)||0)+1);
  const sorted=[...counts.entries()].sort((a,b)=>b[1]-a[1]);
  if(!sorted.length||(sorted[1]&&sorted[0][1]===sorted[1][1])||sorted[0][0]==='SKIP')r.lastMeetingResult='La votación ha terminado en empate o sin expulsión. Nadie sale de la partida.';
  else{const target=r.players.get(sorted[0][0]);if(target&&target.alive){target.alive=false;target.ejected=true;transferPendingTasksToSurvival(r,target);r.lastMeetingResult=target.name+' ha sido expulsado. Sus misiones pendientes pasan a los supervivientes.';}else r.lastMeetingResult='No se ha podido determinar una expulsión.';}
  const ended=checkGameWinner(r);if(!ended){r.meeting=null;r.status='playing';notifyRoom(r,'Reunión finalizada',r.lastMeetingResult,'info');}
  r.completedTasks=completedCount(r);broadcast(r);sendPrivate(r);
}
function pauseGame(r){
  if(!['playing','meeting'].includes(r.status))return false;
  r.pausedFromStatus=r.status;r.pausedAt=Date.now();r.remainingGameMs=Math.max(0,(r.endsAt||Date.now())-Date.now());
  if(r.endTimer)clearTimeout(r.endTimer);r.endTimer=null;
  if(r.status==='meeting'&&r.meeting?.phase==='discussion'){
    r.remainingMeetingMs=Math.max(0,(r.meeting.discussionEndsAt||Date.now())-Date.now());
    if(r.meetingTimer)clearTimeout(r.meetingTimer);r.meetingTimer=null;
  }
  r.status='paused';notifyRoom(r,'Partida pausada','El anfitrión ha pausado la partida.','warning');return true;
}
function resumeGame(r){
  if(r.status!=='paused')return false;
  r.status=r.pausedFromStatus||'playing';r.pausedFromStatus=null;r.pausedAt=null;
  r.endsAt=Date.now()+(r.remainingGameMs||0);r.endTimer=setTimeout(()=>{finishGame(r,null,'time_limit');broadcast(r);sendPrivate(r);},Math.max(0,r.remainingGameMs||0));
  if(r.status==='meeting'&&r.meeting?.phase==='discussion'){
    r.meeting.discussionEndsAt=Date.now()+(r.remainingMeetingMs||0);
    r.meetingTimer=setTimeout(()=>beginMeetingVoting(r),Math.max(0,r.remainingMeetingMs||0));
  }
  r.remainingGameMs=null;r.remainingMeetingMs=null;notifyRoom(r,'Partida reanudada','El tiempo vuelve a correr.','success');if(r.status==='meeting'&&r.meeting?.phase==='voting'&&connectedLiving(r).every(p=>r.meeting.votes.has(p.id)))resolveMeeting(r);return true;
}
function resetForRematch(r){
  if(r.countdownTimer)clearTimeout(r.countdownTimer);if(r.endTimer)clearTimeout(r.endTimer);if(r.meetingTimer)clearTimeout(r.meetingTimer);
  r.countdownTimer=null;r.endTimer=null;r.meetingTimer=null;r.countdownAt=null;r.endsAt=null;r.startedAt=null;
  r.status='lobby';r.meeting=null;r.lastMeetingResult=null;r.winner=null;r.finishReason=null;r.lastStats=null;
  r.taskInstances=new Map();r.survivalTasks=[];r.completedTasks=0;r.totalTaskAssignments=0;r.eliminationRequests=new Map();r.reportCode=null;
  r.players.forEach(player=>{player.ready=false;player.role=null;player.alive=true;player.ejected=false;player.discovered=false;player.assignedTasks=[];player.eliminations=0;player.votesCast=0;});
  r.pausedFromStatus=null;r.remainingGameMs=null;r.remainingMeetingMs=null;r.meetingCount=0;r.totalVotes=0;r.issues=[];
}
function cancelRequestsFor(r,pid){for(const [id,q] of r.eliminationRequests){if(q.targetId===pid||q.killerId===pid){r.eliminationRequests.delete(id);const other=q.targetId===pid?q.killerId:q.targetId;io.to(other).emit('elimination:result',{ok:false,message:'La solicitud se ha cancelado.'});}}}

io.on('connection',socket=>{
  socket.on('room:create',({name,missionHistory},cb=()=>{})=>{const n=cleanName(name);if(!n)return cb({error:'Escribe tu nombre.'});let code;do{code=roomCode();}while(rooms.has(code));const r={code,status:'lobby',players:new Map(),hostId:socket.id,countdownTimer:null,endTimer:null,countdownAt:null,endsAt:null,taskInstances:new Map(),survivalTasks:[],completedTasks:0,totalTaskAssignments:0,eliminationRequests:new Map(),meeting:null,meetingTimer:null,lastMeetingResult:null,winner:null,finishReason:null,config:{...DEFAULT_CONFIG,missionTypes:{...DEFAULT_CONFIG.missionTypes}},history:[],meetingCount:0,totalVotes:0,issues:[],cardAssignments:new Map()};const p={id:socket.id,sessionToken:crypto.randomBytes(24).toString('hex'),name:n,photo:null,cardNumber:1,ready:false,connected:true,role:null,alive:true,assignedTasks:[],missionHistory:cleanMissionHistory(missionHistory),eliminations:0,votesCast:0};r.players.set(p.id,p);r.cardAssignments.set(1,p.id);rooms.set(code,r);socket.join(code);cb({state:privateState(r,p)});broadcast(r);});
  socket.on('room:join',({code:raw,name,missionHistory},cb=()=>{})=>{const code=String(raw||'').trim().toUpperCase(),r=rooms.get(code),n=cleanName(name);if(!r)return cb({error:'No existe esa sala.'});if(!n)return cb({error:'Escribe tu nombre.'});if(r.status!=='lobby')return cb({error:'La partida ya ha comenzado.'});if(r.players.size>=MAX_PLAYERS)return cb({error:'La sala está completa.'});if([...r.players.values()].some(p=>p.name.toLowerCase()===n.toLowerCase()))return cb({error:'Ese nombre ya está en la sala.'});const used=new Set([...r.players.values()].map(x=>x.cardNumber));let cardNumber=1;while(used.has(cardNumber)&&cardNumber<=MAX_PLAYERS)cardNumber++;const p={id:socket.id,sessionToken:crypto.randomBytes(24).toString('hex'),name:n,photo:null,cardNumber,ready:false,connected:true,role:null,alive:true,assignedTasks:[],missionHistory:cleanMissionHistory(missionHistory),eliminations:0,votesCast:0};r.players.set(p.id,p);r.cardAssignments.set(cardNumber,p.id);socket.join(code);cb({state:privateState(r,p)});broadcast(r);});
  socket.on('room:reconnect',({code:raw,token},cb=()=>{})=>{
    const code=String(raw||'').trim().toUpperCase(),room=rooms.get(code);
    if(!room||!token)return cb({error:'No se ha podido recuperar la partida. Vuelve a entrar con el código.'});
    const entry=[...room.players.entries()].find(([,player])=>player.sessionToken===token);
    if(!entry)return cb({error:'La sesión ya no existe. Vuelve a entrar con el código de sala.'});
    const [oldId,player]=entry;
    if(oldId!==socket.id){room.players.delete(oldId);player.id=socket.id;room.players.set(socket.id,player);remapPlayerReferences(room,oldId,socket.id);const oldSocket=io.sockets.sockets.get(oldId);if(oldSocket&&oldSocket.connected)oldSocket.disconnect(true);}
    player.connected=true;socket.join(code);
    if(!room.players.has(room.hostId)||!room.players.get(room.hostId)?.connected)room.hostId=player.id;
    if(['lobby','countdown'].includes(room.status))maybeStart(room);
    cb({state:privateState(room,player)});broadcast(room);sendPrivate(room);notifyRoom(room,'Jugador reconectado',player.name+' ha vuelto a la partida.','info');
  });
  socket.on('player:profile',(payload,cb=()=>{})=>{const room=findRoom(socket.id),p=room?.players.get(socket.id);if(!room||!p)return cb({error:'No estás en una sala.'});const photo=payload?.photo;if(photo===null)p.photo=null;else if(typeof photo==='string'&&/^data:image\/(jpeg|png|webp);base64,/.test(photo)&&photo.length<=50000)p.photo=photo;else return cb({error:'La foto no es válida o pesa demasiado.'});broadcast(room);sendPrivate(room);cb({ok:true});});
  socket.on('host:finish-room',(_,cb=()=>{})=>{const room=findRoom(socket.id),host=room?.players.get(socket.id);if(!room||host?.id!==room.hostId)return cb({error:'Solo el anfitrión puede finalizar la sala.'});for(const t of [room.countdownTimer,room.endTimer,room.meetingTimer])if(t)clearTimeout(t);notifyRoom(room,'Sala finalizada','El anfitrión ha cerrado la sala.','warning');for(const p of room.players.values())io.to(p.id).emit('room:closed',{message:'El anfitrión ha finalizado la sala.'});rooms.delete(room.code);cb({ok:true});});
  socket.on('host:assign-card',({playerId,cardNumber},cb=()=>{})=>{const room=findRoom(socket.id),host=room?.players.get(socket.id),target=room?.players.get(playerId),number=Number(cardNumber);if(!room||host?.id!==room.hostId||room.status!=='lobby')return cb({error:'Solo el anfitrión puede asignar fichas en la pre-sala.'});if(!target||!Number.isInteger(number)||number<1||number>room.players.size)return cb({error:'Ficha o jugador no válido.'});const occupied=room.cardAssignments.get(number);if(occupied&&occupied!==target.id)return cb({error:'Esa ficha ya está asignada a otro participante.'});for(const [n,id] of room.cardAssignments)if(id===target.id)room.cardAssignments.delete(n);target.cardNumber=number;room.cardAssignments.set(number,target.id);broadcast(room);sendPrivate(room);cb({ok:true});});
  socket.on('host:test-room',(_,cb=()=>{})=>{const room=findRoom(socket.id),host=room?.players.get(socket.id);if(!room||host?.id!==room.hostId||room.status!=='lobby')return cb({error:'Solo el anfitrión puede probar la sala antes de empezar.'});cb({ok:true,connected:[...room.players.values()].filter(p=>p.connected).length,total:room.players.size,assignedCards:room.cardAssignments.size,qrReady:CARD_TOKENS.length===25,photos:[...room.players.values()].filter(p=>p.photo).length});});
  socket.on('game:report-card',({token},cb=()=>{})=>{const room=findRoom(socket.id),reporter=room?.players.get(socket.id),number=CARD_NUMBER_BY_TOKEN.get(String(token||''));if(!room||room.status!=='playing'||!reporter?.alive)return cb({error:'Solo un jugador vivo puede reportar una ficha durante la partida.'});if(!number)return cb({error:'El código QR no es válido.'});const playerId=room.cardAssignments.get(number),found=playerId?room.players.get(playerId):null;if(!found||found.alive||found.discovered||found.ejected)return cb({error:'Esta ficha no corresponde a un jugador eliminado pendiente de reportar en esta sala.'});found.discovered=true;room.meeting={reporterId:reporter.id,bodyPlayerId:found.id,votes:new Map(),phase:'discussion',discussionEndsAt:Date.now()+room.config.debateMinutes*60000};room.status='meeting';room.meetingCount=(room.meetingCount||0)+1;room.lastMeetingResult=null;if(room.meetingTimer)clearTimeout(room.meetingTimer);room.meetingTimer=setTimeout(()=>beginMeetingVoting(room),room.config.debateMinutes*60000);broadcast(room);sendPrivate(room);notifyRoom(room,'¡Reunión de emergencia!','Se ha encontrado una ficha eliminada.','meeting');cb({ok:true,playerName:found.name,discussionEndsAt:room.meeting.discussionEndsAt});});
  socket.on('room:configure',(payload,cb=()=>{})=>{
    const room=findRoom(socket.id),player=room?.players.get(socket.id);
    if(!room||!player||player.id!==room.hostId)return cb({error:'Solo el anfitrión puede cambiar la configuración.'});
    if(room.status!=='lobby')return cb({error:'La configuración solo se puede cambiar antes de comenzar.'});
    try{room.config=cleanConfig(payload,room.players.size);broadcast(room);sendPrivate(room);cb({ok:true,config:room.config});}
    catch(error){cb({error:error.message||'Configuración no válida.'});}
  });
  socket.on('host:pause',(_,cb=()=>{})=>{const room=findRoom(socket.id),player=room?.players.get(socket.id);if(!room||player?.id!==room.hostId)return cb({error:'Solo el anfitrión puede pausar.'});if(!pauseGame(room))return cb({error:'La partida no se puede pausar ahora.'});broadcast(room);sendPrivate(room);cb({ok:true});});
  socket.on('host:resume',(_,cb=()=>{})=>{const room=findRoom(socket.id),player=room?.players.get(socket.id);if(!room||player?.id!==room.hostId)return cb({error:'Solo el anfitrión puede reanudar.'});if(!resumeGame(room))return cb({error:'La partida no está pausada.'});broadcast(room);sendPrivate(room);cb({ok:true});});
  socket.on('game:rematch',(_,cb=()=>{})=>{const room=findRoom(socket.id),player=room?.players.get(socket.id);if(!room||player?.id!==room.hostId)return cb({error:'Solo el anfitrión puede iniciar otra partida.'});if(room.status!=='finished')return cb({error:'La partida todavía no ha terminado.'});resetForRematch(room);broadcast(room);sendPrivate(room);notifyRoom(room,'Nueva ronda preparada','La sala se mantiene. Todos deben volver a marcarse como listos.','success');cb({ok:true});});
  socket.on('host:remove-player',({playerId},cb=()=>{})=>{const room=findRoom(socket.id),host=room?.players.get(socket.id);if(!room||host?.id!==room.hostId)return cb({error:'Solo el anfitrión puede gestionar la sala.'});if(room.status!=='lobby')return cb({error:'Solo se pueden retirar jugadores antes de comenzar.'});const target=room.players.get(playerId);if(!target||target.id===host.id)return cb({error:'No se puede retirar a ese jugador.'});room.players.delete(target.id);for(const [number,id] of room.cardAssignments)if(id===target.id)room.cardAssignments.delete(number);const targetSocket=io.sockets.sockets.get(target.id);if(targetSocket){targetSocket.emit('room:removed',{message:'El anfitrión te ha retirado de la sala.'});targetSocket.leave(room.code);}broadcast(room);sendPrivate(room);cb({ok:true});});
  socket.on('player:report-issue',({taskId,message},cb=()=>{})=>{
    const room=findRoom(socket.id),player=room?.players.get(socket.id);
    if(!room||room.status!=='playing'||!player?.alive)return cb({error:'Solo puedes reportar incidencias durante la partida y mientras sigas vivo.'});
    const task=[...(player.assignedTasks||[]),...(room.survivalTasks||[])].find(item=>item.id===taskId&&!item.completed);
    if(!task)return cb({error:'No se encuentra una misión pendiente para reportar.'});
    const text=String(message||'').trim().replace(/[<>]/g,'').slice(0,220);
    if(!text)return cb({error:'Escribe brevemente qué problema has encontrado.'});
    const issue={id:crypto.randomUUID(),playerId:player.id,playerName:player.name,taskId,missionTitle:mission(task.missionId).title,message:text,status:'open',createdAt:Date.now()};
    room.issues=room.issues||[];room.issues.push(issue);
    const host=room.players.get(room.hostId);if(host?.connected)io.to(host.id).emit('host:issue',issue);
    sendPrivate(room);cb({ok:true});
  });
  socket.on('host:resolve-issue',({issueId},cb=()=>{})=>{
    const room=findRoom(socket.id),host=room?.players.get(socket.id);
    if(!room||host?.id!==room.hostId)return cb({error:'Solo el anfitrión puede gestionar incidencias.'});
    const issue=(room.issues||[]).find(item=>item.id===issueId&&item.status==='open');
    if(!issue)return cb({error:'La incidencia ya no está pendiente.'});
    issue.status='resolved';issue.resolvedAt=Date.now();issue.resolvedBy=host.name;
    notifyRoom(room,'Incidencia atendida','El organizador ha revisado una incidencia de misión.','info');
    broadcast(room);sendPrivate(room);cb({ok:true});
  });
  socket.on('player:ready',({ready},cb=()=>{})=>{const r=findRoom(socket.id);if(!r||r.status!=='lobby')return cb({error:'No se puede cambiar ahora.'});r.players.get(socket.id).ready=!!ready;maybeStart(r);sendPrivate(r);cb({ok:true});});
  socket.on('game:task-complete',({taskId},cb=()=>{})=>{const r=findRoom(socket.id),p=r?.players.get(socket.id);if(!r||r.status!=='playing'||!p?.alive)return cb({error:'No puedes completar misiones ahora.'});const shared=(r.survivalTasks||[]).find(x=>x.id===taskId),t=shared||(p.assignedTasks||[]).find(x=>x.id===taskId);if(!t)return cb({error:'Esa misión no está asignada a tu jugador ni a los objetivos comunes.'});if(t.completed)return cb({ok:true,alreadyCompleted:true});if(t.missionId===19)return cb({error:'Esta misión requiere subir una foto como prueba.'});if(shared)t.completed=true;else if(t.type==='pair'){const inst=r.taskInstances.get(t.id);if(!inst||!inst.participants.includes(p.id))return cb({error:'No se encuentra la pareja de esta misión.'});const partnerId=inst.participants.find(id=>id!==p.id),partner=r.players.get(partnerId);if(!partner?.alive)return cb({error:'Tu pareja ha sido eliminada. Elige otra para continuar.'});inst.completedBy.add(p.id);if(inst.participants.every(id=>inst.completedBy.has(id))){for(const id of inst.participants){const q=r.players.get(id),match=q?.assignedTasks?.find(x=>x.id===t.id);if(match){match.completed=true;match.waitingPartner=false;}}}else t.waitingPartner=true;}else t.completed=true;r.completedTasks=completedCount(r);r.totalTaskAssignments=taskRecords(r).length;const won=checkGameWinner(r);if(!won&&t.completed)notifyRoom(r,'Misión completada','Se ha actualizado el progreso general.','task');broadcast(r);sendPrivate(r);cb({ok:true,completed:t.completed,waitingPartner:!!t.waitingPartner,shared:!!shared});});
  socket.on('game:task-proof',({taskId,dataUrl},cb=()=>{})=>{const r=findRoom(socket.id),p=r?.players.get(socket.id);if(!r||r.status!=='playing'||!p?.alive)return cb({error:'No puedes subir una prueba ahora.'});const t=(r.survivalTasks||[]).find(x=>x.id===taskId&&x.missionId===19)||(p.assignedTasks||[]).find(x=>x.id===taskId&&x.missionId===19);if(!t)return cb({error:'La misión con foto no está asignada a tu jugador ni a los objetivos comunes.'});if(typeof dataUrl!=='string'||!/^data:image\/(jpeg|png|webp);base64,/.test(dataUrl)||dataUrl.length>850000)return cb({error:'La imagen no es válida o pesa demasiado.'});t.photoProof=dataUrl;t.completed=true;r.completedTasks=completedCount(r);r.totalTaskAssignments=taskRecords(r).length;const won=checkGameWinner(r);if(!won)notifyRoom(r,'Misión completada','Se ha actualizado el progreso general.','task');broadcast(r);sendPrivate(r);cb({ok:true});});
  socket.on('game:change-partner',({taskId,newPartnerId},cb=()=>{})=>{
    const r=findRoom(socket.id),p=r?.players.get(socket.id),replacement=r?.players.get(newPartnerId);
    if(!r||r.status!=='playing'||!p?.alive)return cb({error:'No puedes cambiar de pareja ahora.'});
    const t=(p.assignedTasks||[]).find(x=>x.id===taskId&&x.type==='pair');
    if(!t||t.completed)return cb({error:'No se encuentra esa misión por parejas pendiente.'});
    const oldPartner=r.players.get(t.partnerId);
    if(oldPartner?.alive)return cb({error:'Solo puedes cambiar de pareja si la anterior ha sido eliminada.'});
    if(!replacement?.alive||replacement.id===p.id)return cb({error:'Elige a otro jugador que siga vivo.'});
    if((replacement.assignedTasks||[]).some(x=>x.id===taskId))return cb({error:'Ese jugador ya tiene asignada esta misión.'});
    const inst=r.taskInstances.get(taskId);
    if(!inst)return cb({error:'No se encuentra la información de esta misión.'});
    for(const q of r.players.values())if(q.id!==p.id)q.assignedTasks=(q.assignedTasks||[]).filter(x=>x.id!==taskId);
    inst.participants=[p.id,replacement.id];inst.completedBy=new Set();
    if(inst.missionId===2&&!inst.participants.includes(inst.describerId))inst.describerId=pick(inst.participants);
    t.partnerId=replacement.id;t.waitingPartner=false;t.completed=false;t.combo=inst.combo||null;
    t.isDescriber=inst.describerId===p.id;t.imageCard=t.isDescriber?inst.imageCard:null;
    replacement.assignedTasks.push({...t,partnerId:p.id,isDescriber:inst.describerId===replacement.id,imageCard:inst.describerId===replacement.id?inst.imageCard:null,waitingPartner:false,completed:false});
    r.totalTaskAssignments=taskRecords(r).length;r.completedTasks=completedCount(r);
    broadcast(r);sendPrivate(r);cb({ok:true});
  });
  socket.on('game:partner-alert',({taskId},cb=()=>{})=>{const r=findRoom(socket.id),p=r?.players.get(socket.id);if(!r||r.status!=='playing'||!p?.alive)return cb({error:'No puedes enviar avisos ahora.'});const t=(p.assignedTasks||[]).find(x=>x.id===taskId&&x.type==='pair');if(!t||!t.partnerId)return cb({error:'Esta no es una misión por parejas.'});if(t.lastAlertAt&&Date.now()-t.lastAlertAt<15000)return cb({error:'Espera unos segundos antes de volver a avisar.'});t.lastAlertAt=Date.now();const partner=r.players.get(t.partnerId);if(!partner?.alive||!partner.connected)return cb({error:'Tu compañero no está conectado.'});io.to(partner.id).emit('partner:alert',{from:p.name,title:mission(t.missionId).title});cb({ok:true});});
  socket.on('game:elimination-request',({targetId},cb=()=>{})=>{const r=findRoom(socket.id),killer=r?.players.get(socket.id),target=r?.players.get(targetId);if(!r||r.status!=='playing'||!killer?.alive||killer.role!=='IMPOSTOR')return cb({error:'Solo un impostor activo puede solicitar una eliminación secreta.'});if(!target||!target.alive||target.id===killer.id)return cb({error:'Ese jugador no está disponible.'});for(const [id,q] of r.eliminationRequests)if(q.expiresAt<Date.now())r.eliminationRequests.delete(id);if([...r.eliminationRequests.values()].some(q=>q.killerId===killer.id||q.targetId===target.id))return cb({error:'Ya hay una solicitud pendiente para ti o para ese jugador.'});const id=crypto.randomUUID();r.eliminationRequests.set(id,{killerId:killer.id,targetId:target.id,expiresAt:Date.now()+90000});io.to(target.id).emit('elimination:pending',{requestId:id});cb({ok:true,message:'Solicitud privada enviada. Esperando confirmación del jugador.'});});
  socket.on('game:elimination-response',({requestId,confirm},cb=()=>{})=>{const r=findRoom(socket.id),p=r?.players.get(socket.id),q=r?.eliminationRequests.get(requestId);if(!r||!p||!q||q.targetId!==p.id)return cb({error:'La solicitud ya no está disponible.'});r.eliminationRequests.delete(requestId);if(q.expiresAt<Date.now()){io.to(q.killerId).emit('elimination:result',{ok:false,message:'La solicitud ha caducado.'});return cb({error:'La solicitud ha caducado.'});}if(confirm&&p.alive&&r.status==='playing'){p.alive=false;const killer=r.players.get(q.killerId);if(killer)killer.eliminations=(killer.eliminations||0)+1;transferPendingTasksToSurvival(r,p);cancelRequestsFor(r,p.id);checkGameWinner(r);broadcast(r);sendPrivate(r);notifyRoom(r,'Jugador eliminado','Se ha registrado una eliminación en la partida.','warning');io.to(q.killerId).emit('elimination:result',{ok:true,message:'El jugador ha confirmado la eliminación.'});cb({ok:true,eliminated:true});}else{io.to(q.killerId).emit('elimination:result',{ok:false,message:'La otra persona no ha confirmado la solicitud.'});cb({ok:true,eliminated:false});}});
  socket.on('game:report-discovery',({playerId},cb=()=>{})=>{const r=findRoom(socket.id),reporter=r?.players.get(socket.id),found=r?.players.get(playerId);if(!r||r.status!=='playing'||!reporter?.alive)return cb({error:'No puedes convocar una reunión ahora.'});if(!found||found.alive||found.discovered||found.ejected)return cb({error:'No se ha encontrado a ese jugador o ya se ha reportado.'});found.discovered=true;r.meeting={reporterId:reporter.id,bodyPlayerId:found.id,votes:new Map(),phase:'discussion',discussionEndsAt:Date.now()+r.config.debateMinutes*60000};r.status='meeting';r.meetingCount=(r.meetingCount||0)+1;r.lastMeetingResult=null;if(r.meetingTimer)clearTimeout(r.meetingTimer);r.meetingTimer=setTimeout(()=>beginMeetingVoting(r),r.config.debateMinutes*60000);broadcast(r);sendPrivate(r);notifyRoom(r,'¡Reunión de emergencia!','Se ha reportado un jugador eliminado.','meeting');cb({ok:true,discussionEndsAt:r.meeting.discussionEndsAt});});
  socket.on('game:vote',({targetId},cb=()=>{})=>{const r=findRoom(socket.id),p=r?.players.get(socket.id);if(!r||r.status!=='meeting'||!r.meeting||r.meeting.phase!=='voting'||!p?.alive)return cb({error:r?.meeting?.phase==='discussion'?'El debate sigue abierto. La votación comenzará al terminar los tres minutos.':'No puedes votar en esta reunión.'});if(r.meeting.votes.has(p.id))return cb({error:'Ya has votado.'});const choice=targetId==='SKIP'?'SKIP':String(targetId||'');if(choice!=='SKIP'&&!r.players.get(choice)?.alive)return cb({error:'Ese jugador no está disponible para votar.'});r.meeting.votes.set(p.id,choice);p.votesCast=(p.votesCast||0)+1;r.totalVotes=(r.totalVotes||0)+1;if(connectedLiving(r).every(q=>r.meeting.votes.has(q.id)))resolveMeeting(r);else{broadcast(r);sendPrivate(r);}cb({ok:true});});
  socket.on('disconnect',()=>{for(const r of rooms.values()){const p=r.players.get(socket.id);if(!p)continue;p.connected=false;if(r.hostId===socket.id){const next=[...r.players.values()].find(x=>x.connected);r.hostId=next?.id||null;}if(r.status==='countdown')maybeStart(r);if(r.meeting&&r.meeting.phase==='voting')resolveMeeting(r);broadcast(r);sendPrivate(r);break;}});
});
server.listen(PORT,()=>console.log('Among Fest escuchando en http://localhost:'+PORT));