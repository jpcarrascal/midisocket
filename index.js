const express = require('express');
const fs = require('fs');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const { AllSessions } = require("./scripts/sessionObj.js");
const config = require('./scripts/config.js');
const cookie = require("cookie");

const { createLogger, format, transports } = require('winston');
const { combine, timestamp, label, printf } = format;

const myFormat = printf(({ level, message, label, timestamp }) => {
  return `${timestamp} ${message}`;
});

const logger = createLogger({
  format: combine(
    label({ label: 'midisocket' }),
    timestamp(),
    myFormat
  ),
  transports: [
      new transports.Console(),
      new transports.File({ filename: 'info.log' })
    ]
});

// config.NUM_TRACKS = 100;
var sessions = new AllSessions(config.NUM_TRACKS);

app.get('/', (req, res) => {
    // req.query.seq
    var page = '/html/index-sequencer.html';
    res.sendFile(__dirname + page);
});

app.get('/sequencer', (req, res) => {
    if(req.query.session)
        var page = '/html/sequencer.html';
    else
        var page = '/html/index-sequencer.html';
    res.sendFile(__dirname + page);
});

app.get('/testaudio', (req, res) => {
    var page = '/html/testaudio.html';
    res.sendFile(__dirname + page);
});

app.get('/track', (req, res) => {
    var page = '/html/track.html';
    res.sendFile(__dirname + page);
});

app.get('/favicon.ico', (req, res) => {
    // req.query.seq
    var page = '/images/favicon.ico';
    res.sendFile(__dirname + page);
});

app.get('/latency', (req, res) => {
    // req.query.seq
    var page = '/html/latency.html';
    res.sendFile(__dirname + page);
});

app.use('/scripts', express.static(__dirname + '/scripts/'));
app.use('/css', express.static(__dirname + '/css/'));
app.use('/images', express.static(__dirname + '/images/'));

io.on('connection', (socket) => {
    var seq = false;
    if(socket.handshake.headers.referer.includes("sequencer"))
        seq = true;
    var session = socket.handshake.query.session;
    var initials = socket.handshake.query.initials;
    //var initials = socket.handshake.headers['user-agent'];
    //var allocationMethod = socket.handshake.query.method || "random";
    var allocationMethod = "random";
    socket.join(session);
    if(seq) {
        var cookief = socket.handshake.headers.cookie; 
        var cookies = cookie.parse(socket.handshake.headers.cookie);    
        const exists = sessions.select(session);
        // TODO: Let sessions be initiated by tracks
        if(exists >= 0) {
            io.to(socket.id).emit('sequencer exists', {reason: ("Session '" + session + "' exists. Choose a different name.")});
            logger.info("#" + session + " @SEQUENCER exists already.");
        }
        else {
            sessions.addSession(session, config.NUM_TRACKS, config.NUM_STEPS, allocationMethod, config.MAX_NUM_ROUNDS);
            sessions.select(session).setAttribute("isPlaying", false);
            logger.info("#" + session + " @SEQUENCER joined session.");
            sessions.select(session).setSeqID(socket.id);
            socket.on('disconnect', () => {
                logger.info("#" + session + " @SEQUENCER disconnected (sequencer). Clearing session");
                socket.broadcast.to(session).emit('exit session',{reason: "Sequencer exited!"});
                sessions.select(session).clearSession();
            });
            // TODO: Send all tracks to sequencer
            /*
            var allParticipants = sessions.getAllParticipants(session);
            var joinedParticipants = [];
            allParticipants.forEach(function(value, index, arr){
                if(value !== "")
                    joinedParticipants.push({track: value.track, socketID: value.socketID});
            });
            io.to(socket.id).emit('joined tracks', {tracks: joinedParticipants});
            */
        }
    } else {
        const currentSession = sessions.select(session);
        if(sessions.select(session).isReady()) {
            var track = currentSession.allocateAvailableParticipant(socket.id, initials);
            logger.info("#" + session + " @[" + initials + "] joined session on track " + track);
            socket.broadcast.to(session).emit('track joined', { initials: initials, track:track, socketID: socket.id });
            // Send track info to track on connection
            //io.to(socket.id).emit('track data', {track});
            socket.on('disconnect', () => {
                var track2delete = currentSession.getParticipantNumber(socket.id);
                currentSession.releaseParticipant(socket.id);
                io.to(session).emit('track left', {track: track2delete, initials: initials, socketID: socket.id});
                logger.info("#" + session + " @[" + initials + "] (" + socket.id + ") disconnected, clearing track " + track2delete);
            });
            // TODO: create session attributes. The line below should look like:
            // io.to(socket.id).emit('session is playing', {playing: sessions.getAttribute(session, "isPlaying")});
            //io.to(socket.id).emit('session is playing', {playing: sessions.isPlaying(session)});
            var sessionStarted = currentSession.getAttribute("isPlaying");
            if(sessionStarted) {
                io.to(socket.id).emit('veil-off', {socketID: socket.id});
            } else {
                io.to(socket.id).emit('veil-on', {socketID: socket.id});
            }
        } else {
            io.to(socket.id).emit('exit session', {reason: "Session has not started..."});
        }
    }
    
    socket.on('step update', (msg) => { // Send step values
        io.to(session).emit('step update', msg);
        const currentSession = sessions.select(session);
        if(currentSession) {
            currentSession.participantStartCounting(socket.id);
            let initials = currentSession.getParticipantInitials(socket.id);
            if(seq) initials = "seq";
            logger.info("#" + session + " @[" + initials + "] step_update event: " + msg.action +
                            " track: " + msg.track + " step: " +msg.step +
                            " note: " + msg.note + " value: " +msg.value);
        }
    });

    socket.on('track notes', (msg) => { // Send all notes from track
        io.to(msg.socketID).emit('update track', msg);
    });

    socket.on('track data', (msg) => { // Send all notes from track
        // io.to(msg.socketID).emit('track update', msg);
        socket.broadcast.to(session).emit('track data', msg);
    });

    socket.on('session pause', (msg) => {
        socket.broadcast.to(session).emit('veil-on', msg);
        const currentSession = sessions.select(session);
        if(currentSession) currentSession.setAttribute("isPlaying", false);
        logger.info("#" + session + " Veil ON.");
    });

    socket.on('session play', (msg) => {
        socket.broadcast.to(session).emit('veil-off', msg);
        const currentSession = sessions.select(session);
        if(currentSession) currentSession.setAttribute("isPlaying", true);
        logger.info("#" + session + " Veil OFF.");
    });

    socket.on('ping', (msg) => {
        io.to(socket.id).emit('pong', msg);
    });

    socket.on('track ready', (msg) => {
        socket.broadcast.to(session).emit('track ready', msg);
        logger.info("#" + session + " (" + msg.socketID + ") ready to play");
    });

    socket.on('midi message', (msg) => {
        const messageType = msg.message[0] >> 4;
        var type = 'OTHER';
        switch (messageType) {
          case 0x8:
            type = 'NOTE_OFF'; break;
          case 0x9:
            type = 'NOTE_ON'; break;
          case 0xB:
            type = 'CC_CHANGE'; break;
          case 0xC:
            type = 'P_CHANGE'; break;
        case 0xD:
            type = 'PRESSURE'; break;
          case 0xE:
            type = 'PITCH_BEND'; break;
          default:
            type = 'OTHER';
        }
        io.to(session).emit('midi message', msg);
        logger.info("#" + session + " (" + msg.socketID + ") MIDI message (" + type + " from " + msg.source + ")");
    });

    /*
    socket.onAny((event, msg) => {
        console.log(event)
        console.log(msg);
    });
    */

});

var port = process.env.PORT || 3000;
server.listen(port, () => {
  logger.info('listening on *:' + port);
});


function exitHandler(options, exitCode) {
    logger.info("Bye!!!")
    if (options.cleanup) logger.info('clean');
    if (exitCode || exitCode === 0) logger.info(exitCode);
    if (options.exit) process.exit();
}

process.on('SIGINT', exitHandler.bind(null, {exit:true}));