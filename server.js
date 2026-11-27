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
const MAX_PLAYERS = 25, MIN_PLAYERS = 4, START_DELAY = 10, GAME_SECONDS = 3600, MEETING_DISCUSSION_SECONDS = 180;

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
const SECRET_PHRASES = ['Luna violeta','Cometa azul','Nebulosa roja','Órbita secreta','Estrella fugaz'];
const REPORT_WORDS = ['GALAXIA','COMETA','NEBULOSA','ASTEROIDE','SATURNO'];
const pick = a => a[crypto.randomInt(a.length)];
function shuffle(a) { const b=[...a]; for(let i=b.length-1;i>0;i--){const j=crypto.randomInt(i+1);[b[i],b[j]]=[b[j],b[i]];} return b; }
function roomCode(){const a='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';return Array.from({length:4},()=>a[crypto.randomInt(a.length)]).join('');}
function cleanName(v){return String(v||'').trim().replace(/[<>]/g,'').slice(0,18);}
function living(room){return [...room.players.values()].filter(p=>p.alive);}
function connectedLiving(room){return living(room).filter(p=>p.connected);}
function mission(id){return BY_ID.get(id);}
function cleanMissionHistory(value){if(!Array.isArray(value))return [];return value.map(Number).filter(id=>BY_ID.has(id)).slice(0,60);}
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
  code:room.code,status:room.status,
  players:[...room.players.values()].map(p=>({id:p.id,name:p.name,ready:p.ready,connected:p.connected,alive:!!p.alive,ejected:!!p.ejected,isHost:p.id===room.hostId})),
  maxPlayers:MAX_PLAYERS,minPlayers:MIN_PLAYERS,countdown:room.countdownAt||null,endsAt:room.endsAt||null,
  completedTasks:room.completedTasks||0,totalTaskAssignments:room.totalTaskAssignments||0,
  meeting:room.meeting?{reporterName:room.players.get(room.meeting.reporterId)?.name||'Jugador',foundPlayerName:room.players.get(room.meeting.bodyPlayerId)?.name||'Jugador',phase:room.meeting.phase,discussionEndsAt:room.meeting.discussionEndsAt,votesCast:room.meeting.votes.size,votesNeeded:connectedLiving(room).length}:null,
  lastMeetingResult:room.lastMeetingResult||null
};}
function privateState(room,p){
  const s={room:publicRoom(room),me:{id:p.id,name:p.name,ready:p.ready,alive:p.alive,isHost:p.id===room.hostId}};
  if(['playing','meeting','finished'].includes(room.status)){
    const tasks=p.alive?(p.assignedTasks||[]).map(t=>serializeTask(room,p,t,false)):[];
    const survivalTasks=p.alive?(room.survivalTasks||[]).map(t=>serializeTask(room,p,t,true)):[];
    s.role=p.role;s.mission=p.role==='IMPOSTOR'?'Tienes misiones como el resto. Completa las pruebas sin revelar tu identidad.':'Completa tus misiones y ayuda a descubrir a los impostores.';
    s.game={endsAt:room.endsAt,tasks,survivalTasks,progress:tasks.filter(t=>t.completed).length,total:tasks.length,teamProgress:room.completedTasks||0,teamTotal:room.totalTaskAssignments||0,
      isAlive:p.alive,isHost:p.id===room.hostId,reportCode:p.alive?room.reportCode:null,
      players:[...room.players.values()].map(x=>({id:x.id,name:x.name})),
      eliminationTargets:p.role==='IMPOSTOR'&&p.alive&&room.status==='playing'?living(room).filter(x=>x.id!==p.id).map(x=>({id:x.id,name:x.name})):[],
      voteOptions:room.status==='meeting'&&room.meeting?.phase==='voting'&&p.alive?connectedLiving(room).map(x=>({id:x.id,name:x.name})):[],
      hasVoted:!!(room.meeting&&room.meeting.votes.has(p.id)),meetingResult:room.lastMeetingResult||null
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
  for(const p of ps){
    p.assignedTasks=[];
    for(const id of fairMissions(INDIVIDUAL_IDS,p,2))p.assignedTasks.push({id:crypto.randomUUID(),missionId:id,type:'individual',completed:false});
  }
  const order=shuffle(ps);
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
  if(order.length%2){
    const last=order[order.length-1],used=new Set(last.assignedTasks.map(t=>t.missionId));
    const extra=fairMission(INDIVIDUAL_IDS.filter(id=>!used.has(id)),[last]);
    last.assignedTasks.push({id:crypto.randomUUID(),missionId:extra,type:'individual',completed:false});
  }
  for(const p of ps){
    const special=fairMission(SPECIAL_IDS,[p]);
    p.assignedTasks.push({id:crypto.randomUUID(),missionId:special,type:'special',completed:false});
    p.assignedTasks=shuffle(p.assignedTasks);
  }
  r.totalTaskAssignments=taskRecords(r).length;r.completedTasks=completedCount(r);
}
function startGame(r){const ps=[...r.players.values()].filter(p=>p.connected);if(ps.length<MIN_PLAYERS||!ps.every(p=>p.ready)){r.status='lobby';r.countdownAt=null;broadcast(r);return;}const roles=shuffle(ps),n=Math.max(1,Math.round(ps.length/6));roles.forEach((p,i)=>{p.role=i<n?'IMPOSTOR':'TRIPULANTE';p.alive=true;});assignTasks(r,ps);r.status='playing';r.startedAt=Date.now();r.endsAt=r.startedAt+GAME_SECONDS*1000;r.countdownAt=null;r.reportCode=pick(REPORT_WORDS);r.meeting=null;r.lastMeetingResult=null;r.eliminationRequests=new Map();broadcast(r);sendPrivate(r);r.endTimer=setTimeout(()=>{r.status='finished';r.meeting=null;if(r.meetingTimer)clearTimeout(r.meetingTimer);r.meetingTimer=null;broadcast(r);sendPrivate(r);},GAME_SECONDS*1000);}
function beginMeetingVoting(r){if(!r.meeting||r.meeting.phase!=='discussion')return;if(r.meetingTimer)clearTimeout(r.meetingTimer);r.meetingTimer=null;r.meeting.phase='voting';broadcast(r);sendPrivate(r);}
function resolveMeeting(r){if(!r.meeting||r.meeting.phase!=='voting')return;if(r.meetingTimer)clearTimeout(r.meetingTimer);r.meetingTimer=null;const eligible=connectedLiving(r);if(!eligible.every(p=>r.meeting.votes.has(p.id)))return;const counts=new Map();for(const v of r.meeting.votes.values())counts.set(v,(counts.get(v)||0)+1);const sorted=[...counts.entries()].sort((a,b)=>b[1]-a[1]);if(!sorted.length||(sorted[1]&&sorted[0][1]===sorted[1][1])||sorted[0][0]==='SKIP'){r.lastMeetingResult='La votación ha terminado en empate o sin expulsión. Nadie sale de la partida.';}else{const target=r.players.get(sorted[0][0]);if(target&&target.alive){target.alive=false;target.ejected=true;transferPendingTasksToSurvival(r,target);r.lastMeetingResult=target.name+' ha sido expulsado. Sus misiones pendientes pasan a los supervivientes.';}else r.lastMeetingResult='No se ha podido determinar una expulsión.';}r.meeting=null;r.status='playing';r.completedTasks=completedCount(r);broadcast(r);sendPrivate(r);}
function cancelRequestsFor(r,pid){for(const [id,q] of r.eliminationRequests){if(q.targetId===pid||q.killerId===pid){r.eliminationRequests.delete(id);const other=q.targetId===pid?q.killerId:q.targetId;io.to(other).emit('elimination:result',{ok:false,message:'La solicitud se ha cancelado.'});}}}

io.on('connection',socket=>{
  socket.on('room:create',({name,missionHistory},cb=()=>{})=>{const n=cleanName(name);if(!n)return cb({error:'Escribe tu nombre.'});let code;do{code=roomCode();}while(rooms.has(code));const r={code,status:'lobby',players:new Map(),hostId:socket.id,countdownTimer:null,endTimer:null,countdownAt:null,endsAt:null,taskInstances:new Map(),survivalTasks:[],completedTasks:0,totalTaskAssignments:0,eliminationRequests:new Map(),meeting:null,meetingTimer:null,lastMeetingResult:null};const p={id:socket.id,name:n,ready:false,connected:true,role:null,alive:true,assignedTasks:[],missionHistory:cleanMissionHistory(missionHistory)};r.players.set(p.id,p);rooms.set(code,r);socket.join(code);cb({state:privateState(r,p)});broadcast(r);});
  socket.on('room:join',({code:raw,name,missionHistory},cb=()=>{})=>{const code=String(raw||'').trim().toUpperCase(),r=rooms.get(code),n=cleanName(name);if(!r)return cb({error:'No existe esa sala.'});if(!n)return cb({error:'Escribe tu nombre.'});if(r.status!=='lobby')return cb({error:'La partida ya ha comenzado.'});if(r.players.size>=MAX_PLAYERS)return cb({error:'La sala está completa.'});if([...r.players.values()].some(p=>p.name.toLowerCase()===n.toLowerCase()))return cb({error:'Ese nombre ya está en la sala.'});const p={id:socket.id,name:n,ready:false,connected:true,role:null,alive:true,assignedTasks:[],missionHistory:cleanMissionHistory(missionHistory)};r.players.set(p.id,p);socket.join(code);cb({state:privateState(r,p)});broadcast(r);});
  socket.on('player:ready',({ready},cb=()=>{})=>{const r=findRoom(socket.id);if(!r||r.status!=='lobby')return cb({error:'No se puede cambiar ahora.'});r.players.get(socket.id).ready=!!ready;maybeStart(r);sendPrivate(r);cb({ok:true});});
  socket.on('game:task-complete',({taskId},cb=()=>{})=>{const r=findRoom(socket.id),p=r?.players.get(socket.id);if(!r||r.status!=='playing'||!p?.alive)return cb({error:'No puedes completar misiones ahora.'});const shared=(r.survivalTasks||[]).find(x=>x.id===taskId),t=shared||(p.assignedTasks||[]).find(x=>x.id===taskId);if(!t)return cb({error:'Esa misión no está asignada a tu jugador ni a los objetivos comunes.'});if(t.completed)return cb({ok:true,alreadyCompleted:true});if(t.missionId===19)return cb({error:'Esta misión requiere subir una foto como prueba.'});if(shared)t.completed=true;else if(t.type==='pair'){const inst=r.taskInstances.get(t.id);if(!inst||!inst.participants.includes(p.id))return cb({error:'No se encuentra la pareja de esta misión.'});const partnerId=inst.participants.find(id=>id!==p.id),partner=r.players.get(partnerId);if(!partner?.alive)return cb({error:'Tu pareja ha sido eliminada. Elige otra para continuar.'});inst.completedBy.add(p.id);if(inst.participants.every(id=>inst.completedBy.has(id))){for(const id of inst.participants){const q=r.players.get(id),match=q?.assignedTasks?.find(x=>x.id===t.id);if(match){match.completed=true;match.waitingPartner=false;}}}else t.waitingPartner=true;}else t.completed=true;r.completedTasks=completedCount(r);r.totalTaskAssignments=taskRecords(r).length;broadcast(r);sendPrivate(r);cb({ok:true,completed:t.completed,waitingPartner:!!t.waitingPartner,shared:!!shared});});
  socket.on('game:task-proof',({taskId,dataUrl},cb=()=>{})=>{const r=findRoom(socket.id),p=r?.players.get(socket.id);if(!r||r.status!=='playing'||!p?.alive)return cb({error:'No puedes subir una prueba ahora.'});const t=(r.survivalTasks||[]).find(x=>x.id===taskId&&x.missionId===19)||(p.assignedTasks||[]).find(x=>x.id===taskId&&x.missionId===19);if(!t)return cb({error:'La misión con foto no está asignada a tu jugador ni a los objetivos comunes.'});if(typeof dataUrl!=='string'||!/^data:image\/(jpeg|png|webp);base64,/.test(dataUrl)||dataUrl.length>850000)return cb({error:'La imagen no es válida o pesa demasiado.'});t.photoProof=dataUrl;t.completed=true;r.completedTasks=completedCount(r);r.totalTaskAssignments=taskRecords(r).length;sendPrivate(r);broadcast(r);cb({ok:true});});
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
  socket.on('game:elimination-request',({targetId},cb=()=>{})=>{const r=findRoom(socket.id),killer=r?.players.get(socket.id),target=r?.players.get(targetId);if(!r||r.status!=='playing'||!killer?.alive||killer.role!=='IMPOSTOR')return cb({error:'Solo un impostor activo puede solicitar una eliminación secreta.'});if(!target||!target.alive||target.id===killer.id)return cb({error:'Ese jugador no está disponible.'});for(const [id,q] of r.eliminationRequests)if(q.expiresAt<Date.now())r.eliminationRequests.delete(id);if([...r.eliminationRequests.values()].some(q=>q.killerId===killer.id||q.targetId===target.id))return cb({error:'Ya hay una solicitud pendiente para ti o para ese jugador.'});const id=crypto.randomUUID(),phrase=pick(SECRET_PHRASES);r.eliminationRequests.set(id,{killerId:killer.id,targetId:target.id,phrase,expiresAt:Date.now()+90000});io.to(target.id).emit('elimination:pending',{requestId:id});cb({ok:true,phrase,message:'Di esta clave en voz alta: '+phrase+'. La otra persona debe confirmarlo en su móvil.'});});
  socket.on('game:elimination-response',({requestId,confirm},cb=()=>{})=>{const r=findRoom(socket.id),p=r?.players.get(socket.id),q=r?.eliminationRequests.get(requestId);if(!r||!p||!q||q.targetId!==p.id)return cb({error:'La solicitud ya no está disponible.'});r.eliminationRequests.delete(requestId);if(q.expiresAt<Date.now()){io.to(q.killerId).emit('elimination:result',{ok:false,message:'La solicitud ha caducado.'});return cb({error:'La solicitud ha caducado.'});}if(confirm&&p.alive){p.alive=false;transferPendingTasksToSurvival(r,p);cancelRequestsFor(r,p.id);broadcast(r);sendPrivate(r);io.to(q.killerId).emit('elimination:result',{ok:true,message:'La eliminación secreta ha sido confirmada.'});cb({ok:true,eliminated:true});}else{io.to(q.killerId).emit('elimination:result',{ok:false,message:'La otra persona no ha confirmado la solicitud.'});cb({ok:true,eliminated:false});}});
  socket.on('game:report-discovery',({playerId,word},cb=()=>{})=>{const r=findRoom(socket.id),reporter=r?.players.get(socket.id),found=r?.players.get(playerId);if(!r||r.status!=='playing'||!reporter?.alive)return cb({error:'No puedes convocar una reunión ahora.'});if(!found||found.alive||found.discovered||found.ejected)return cb({error:'No se ha encontrado a ese jugador o ya se ha reportado.'});if(String(word||'').trim().toUpperCase()!==r.reportCode)return cb({error:'La palabra de confirmación no es correcta.'});found.discovered=true;r.meeting={reporterId:reporter.id,bodyPlayerId:found.id,votes:new Map(),phase:'discussion',discussionEndsAt:Date.now()+MEETING_DISCUSSION_SECONDS*1000};r.status='meeting';r.lastMeetingResult=null;if(r.meetingTimer)clearTimeout(r.meetingTimer);r.meetingTimer=setTimeout(()=>beginMeetingVoting(r),MEETING_DISCUSSION_SECONDS*1000);broadcast(r);sendPrivate(r);cb({ok:true,discussionEndsAt:r.meeting.discussionEndsAt});});
  socket.on('game:vote',({targetId},cb=()=>{})=>{const r=findRoom(socket.id),p=r?.players.get(socket.id);if(!r||r.status!=='meeting'||!r.meeting||r.meeting.phase!=='voting'||!p?.alive)return cb({error:r?.meeting?.phase==='discussion'?'El debate sigue abierto. La votación comenzará al terminar los tres minutos.':'No puedes votar en esta reunión.'});if(r.meeting.votes.has(p.id))return cb({error:'Ya has votado.'});const choice=targetId==='SKIP'?'SKIP':String(targetId||'');if(choice!=='SKIP'&&!r.players.get(choice)?.alive)return cb({error:'Ese jugador no está disponible para votar.'});r.meeting.votes.set(p.id,choice);if(connectedLiving(r).every(q=>r.meeting.votes.has(q.id)))resolveMeeting(r);else{broadcast(r);sendPrivate(r);}cb({ok:true});});
  socket.on('disconnect',()=>{for(const r of rooms.values()){const p=r.players.get(socket.id);if(!p)continue;if(r.status==='lobby'||r.status==='countdown'){r.players.delete(socket.id);if(r.hostId===socket.id)r.hostId=r.players.keys().next().value||null;maybeStart(r);}else{p.connected=false;if(r.hostId===socket.id){const next=[...r.players.values()].find(x=>x.connected);if(next)r.hostId=next.id;}if(r.meeting&&r.meeting.phase==='voting')resolveMeeting(r);}if(r.players.size===0){if(r.countdownTimer)clearTimeout(r.countdownTimer);if(r.endTimer)clearTimeout(r.endTimer);if(r.meetingTimer)clearTimeout(r.meetingTimer);rooms.delete(r.code);}else{broadcast(r);sendPrivate(r);}break;}});
});
server.listen(PORT,()=>console.log('Among Fest escuchando en http://localhost:'+PORT));