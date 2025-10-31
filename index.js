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
    res.status(204).end(); // No content for missing favicon
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
    // Determine connection type from query parameters or referrer
    var seq = false;
    var connectionType = socket.handshake.query.type;
    
    // Legacy support - check referrer if type not specified
    if (!connectionType && socket.handshake.headers.referer) {
        seq = socket.handshake.headers.referer.includes("sequencer");
        connectionType = seq ? 'sequencer' : 'track';
    }
    
    var session = socket.handshake.query.session;
    var initials = socket.handshake.query.initials;
    var allocationMethod = "random";
    
    // Join the session room
    socket.join(session);
    
    if (connectionType === 'sequencer') {
        // Handle sequencer connection
        const exists = sessions.select(session);
        
        if(exists >= 0) {
            io.to(socket.id).emit('sequencer exists', {
                reason: `Session '${session}' already has a sequencer. Choose a different name.`
            });
            logger.info(`#${session} @SEQUENCER exists already.`);
        } else {
            // Create new session
            sessions.addSession(session, config.NUM_TRACKS, config.NUM_STEPS, allocationMethod, config.MAX_NUM_ROUNDS);
            sessions.select(session).setAttribute("isPlaying", false);
            sessions.select(session).setSeqID(socket.id);
            
            logger.info(`#${session} @SEQUENCER joined session.`);
            
            // Handle sequencer disconnection
            socket.on('disconnect', () => {
                logger.info(`#${session} @SEQUENCER disconnected. Clearing session.`);
                socket.broadcast.to(session).emit('exit session', {
                    reason: "Sequencer disconnected!"
                });
                sessions.select(session).clearSession();
            });
        }
    } else {
        // Handle track connection
        const currentSession = sessions.select(session);
        
        if (!currentSession || !currentSession.isReady()) {
            io.to(socket.id).emit('exit session', {
                reason: "Session not available. Make sure sequencer is running."
            });
            return;
        }
        
        // Allocate track to participant
        var track = currentSession.allocateAvailableParticipant(socket.id, initials);
        
        if (track === -1) {
            io.to(socket.id).emit('exit session', {
                reason: "Session is full. No available tracks."
            });
            return;
        }
        
        logger.info(`#${session} @[${initials}] joined session on track ${track}`);
        
        // Notify sequencer about new track
        socket.broadcast.to(session).emit('track joined', { 
            initials: initials, 
            track: track, 
            socketID: socket.id 
        });
        
        // Handle track disconnection
        socket.on('disconnect', () => {
            const trackToDelete = currentSession.getParticipantNumber(socket.id);
            currentSession.releaseParticipant(socket.id);
            
            // Notify sequencer about track leaving
            io.to(session).emit('track left', {
                track: trackToDelete, 
                initials: initials, 
                socketID: socket.id
            });
            
            logger.info(`#${session} @[${initials}] (${socket.id}) disconnected, clearing track ${trackToDelete}`);
        });
        
        // Send initial session state to track
        const sessionStarted = currentSession.getAttribute("isPlaying");
        if (sessionStarted) {
            io.to(socket.id).emit('veil-off', { socketID: socket.id });
        } else {
            io.to(socket.id).emit('veil-on', { socketID: socket.id });
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

    // ===== NEW MIDI ROUTING EVENTS =====
    
    // Track requests device assignment information
    socket.on('request-track-assignment', (msg) => {
        console.log('Track requesting assignment:', msg.socketID);
        const currentSession = sessions.select(session);
        if (currentSession) {
            const seqID = currentSession.getSeqID();
            const trackNumber = currentSession.getParticipantNumber(socket.id);
            console.log('Forwarding to sequencer:', seqID, 'track:', trackNumber);
            if (seqID) {
                // Forward request to sequencer to get routing information
                io.to(seqID).emit('get-track-assignment', {
                    socketID: msg.socketID,
                    track: trackNumber
                });
            } else {
                console.warn('No sequencer ID found for session:', session);
            }
        } else {
            console.warn('No session found:', session);
        }
    });
    
    // Track sends MIDI message to be routed by sequencer
    socket.on('track-midi-message', (msg) => {
        const messageType = msg.message[0] >> 4;
        var type = 'OTHER';
        switch (messageType) {
            case 0x8: type = 'NOTE_OFF'; break;
            case 0x9: type = 'NOTE_ON'; break;
            case 0xB: type = 'CC_CHANGE'; break;
            case 0xC: type = 'P_CHANGE'; break;
            case 0xD: type = 'PRESSURE'; break;
            case 0xE: type = 'PITCH_BEND'; break;
            default: type = 'OTHER';
        }
        
        // Forward message to sequencer for routing
        const currentSession = sessions.select(session);
        if (currentSession) {
            const seqID = currentSession.getSeqID();
            if (seqID) {
                io.to(seqID).emit('track-midi-message', {
                    socketID: socket.id,
                    message: msg.message,
                    timestamp: msg.timestamp || Date.now(),
                    source: msg.source || 'track'
                });
                
                // Log MIDI activity
                const initials = currentSession.getParticipantInitials(socket.id) || 'UNKNOWN';
                logger.info(`#${session} @[${initials}] MIDI ${type} routed to sequencer`);
            }
        }
    });
    
    // Sequencer requests routing configuration
    socket.on('request-routing-config', (msg) => {
        // This would be used if we wanted to sync routing config
        // For now, routing is managed entirely on sequencer side
        logger.info(`#${session} Routing config requested by ${socket.id}`);
    });
    
    // Sequencer updates routing configuration
    socket.on('update-routing', (msg) => {
        // Forward routing updates to tracks if needed
        socket.broadcast.to(session).emit('routing-updated', msg);
        logger.info(`#${session} Routing configuration updated`);
    });
    
    // ===== LEGACY MIDI EVENT (for backward compatibility) =====
    
    socket.on('midi message', (msg) => {
        const messageType = msg.message[0] >> 4;
        var type = 'OTHER';
        switch (messageType) {
            case 0x8: type = 'NOTE_OFF'; break;
            case 0x9: type = 'NOTE_ON'; break;
            case 0xB: type = 'CC_CHANGE'; break;
            case 0xC: type = 'P_CHANGE'; break;
            case 0xD: type = 'PRESSURE'; break;
            case 0xE: type = 'PITCH_BEND'; break;
            default: type = 'OTHER';
        }
        
        // Legacy behavior - forward to all clients in session
        io.to(session).emit('midi message', msg);
        logger.info(`#${session} (${msg.socketID}) Legacy MIDI message (${type} from ${msg.source})`);
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