const express = require('express');
const fs = require('fs');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const { AllSessions } = require("./scripts/sessionsObj.js");
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
var sessions = new AllSessions(config.NUM_TRACKS, config.MAX_NUM_ROUNDS);

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
    var allocationMethod = true;
    socket.join(session);
    if(seq) {
        var cookief = socket.handshake.headers.cookie; 
        var cookies = cookie.parse(socket.handshake.headers.cookie);    
        const exists = sessions.findSession(session);
        // TODO: Let sessions be initiated by tracks
        if(exists >= 0) {
            io.to(socket.id).emit('sequencer exists', {reason: ("Session '" + session + "' exists. Choose a different name.")});
            logger.info("#" + session + " @SEQUENCER exists already.");
        }
        else {
            sessions.addSession(session, allocationMethod);
            logger.info("#" + session + " @SEQUENCER joined session.");
            sessions.setSeqID(session,socket.id);
            socket.on('disconnect', () => {
                logger.info("#" + session + " @SEQUENCER disconnected (sequencer). Clearing session");
                socket.broadcast.to(session).emit('exit session',{reason: "Sequencer exited!"});
                sessions.clearSession(session);
            });
            // TODO: Send all tracks to sequencer
            /*
            var allParticipants = sessions.getAllParticipants(session);
            var joinedParticipants = [];
            allParticipants.forEach(function(value, index, arr){
                if(value !== "")
                    joinedParticipants.push({track: value.track, socketid: value.socketid});
            });
            io.to(socket.id).emit('joined tracks', {tracks: joinedParticipants});
            */
        }
    } else {
        if(sessions.isReady(session)) {
            var track = sessions.allocateAvailableParticipant(session, socket.id, initials);
            logger.info("#" + session + " @[" + initials + "] joined session on track " + track);
            socket.broadcast.to(session).emit('track joined', { initials: initials, track:track, socketid: socket.id });
            socket.on('disconnect', () => {
                var track2delete = sessions.getParticipantNumber(session, socket.id);
                sessions.releaseParticipant(session, socket.id);
                io.to(session).emit('track left', {track: track2delete, initials: initials, socketid: socket.id});
                logger.info("#" + session + " @[" + initials + "] (" + socket.id + ") disconnected, clearing track " + track2delete);
            });
            // TODO: create session attributes. The line below should look like:
            // io.to(socket.id).emit('session is playing', {playing: sessions.getAttribute(session, "isPlaying")});
            io.to(socket.id).emit('session is playing', {playing: sessions.isPlaying(session)});
        } else {
            io.to(socket.id).emit('exit session', {reason: "Session has not started..."});
        }
    }
    
    socket.on('step update', (msg) => { // Send step values
        io.to(session).emit('step update', msg);
        sessions.participantStartCounting(session, socket.id);
        let initials = sessions.getParticipantInitials(session, socket.id);
        if(seq) initials = "seq";
        logger.info("#" + session + " @[" + initials + "] step_update event: " + msg.action +
                        " track: " + msg.track + " step: " +msg.step +
                        " note: " + msg.note + " value: " +msg.value);
    });

    socket.on('track notes', (msg) => { // Send all notes from track
        io.to(msg.socketid).emit('update track', msg);
    });

    socket.on('veil-on', (msg) => {
        socket.broadcast.to(session).emit('veil-on', msg);
        logger.info("#" + session + " Veil ON.");
    });

    socket.on('veil-off', (msg) => {
        socket.broadcast.to(session).emit('veil-off', msg);
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
        io.to(session).emit('midi message', msg);
        logger.info("#" + session + " (" + msg.socketID + ") midi message (" + msg.type + ")");
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