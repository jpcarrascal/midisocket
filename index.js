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
const slotTimeouts = new Map(); // key: session:track -> timeout id

function getSlotTimeoutKey(sessionName, trackNumber) {
    return `${sessionName}:${trackNumber}`;
}

function clearTrackSlotTimeout(sessionName, trackNumber) {
    const key = getSlotTimeoutKey(sessionName, trackNumber);
    const timeoutId = slotTimeouts.get(key);
    if (timeoutId) {
        clearTimeout(timeoutId);
        slotTimeouts.delete(key);
    }
}

function clearSessionSlotTimeouts(sessionName) {
    for (const [key, timeoutId] of slotTimeouts.entries()) {
        if (key.startsWith(`${sessionName}:`)) {
            clearTimeout(timeoutId);
            slotTimeouts.delete(key);
        }
    }
}

function emitDeviceAssignments(sessionName, currentSession) {
    const seqID = currentSession.getSeqID();
    if (seqID) {
        io.to(seqID).emit('device-assignments-updated', {
            assignments: currentSession.getDeviceAssignments()
        });
    }
}

function emitQueueUpdates(sessionName, currentSession) {
    const staleSockets = [];
    let queue = currentSession.getWaitingQueue();

    queue.forEach((entry, index) => {
        const waitingSocket = io.sockets.sockets.get(entry.socketID);
        if (!waitingSocket || !waitingSocket.connected) {
            staleSockets.push(entry.socketID);
            return;
        }

        waitingSocket.emit('queue-status', {
            position: index + 1,
            total: queue.length,
            message: `No pedals available right now. You are #${index + 1} in line.`
        });
    });

    if (staleSockets.length > 0) {
        staleSockets.forEach(socketID => currentSession.removeWaitingUser(socketID));
        queue = currentSession.getWaitingQueue();
    }

    const seqID = currentSession.getSeqID();
    if (seqID) {
        io.to(seqID).emit('queue-updated', {
            length: queue.length,
            activeSlots: currentSession.getActiveSlotCount(),
            nextInitials: currentSession.getNextQueuedInitials()
        });
    }
}

function emitTrackAssignment(sessionName, currentSession, socketID, trackNumber) {
    const assignment = currentSession.getDeviceForTrack(trackNumber);
    if (!assignment) {
        return false;
    }

    const configuredDevices = currentSession.getConfiguredDevices() || [];
    const fullDevice = configuredDevices.find(d => d.id === assignment.deviceId) || null;
    const slotInfo = currentSession.getTrackSlot(trackNumber);

    io.to(socketID).emit('track-assignment', {
        socketID: socketID,
        device: fullDevice,
        channel: (fullDevice && Number.isInteger(fullDevice.assignedChannel))
            ? (fullDevice.assignedChannel - 1)
            : 0,
        trackId: trackNumber.toString(),
        trackNumber: trackNumber + 1,
        slotDurationSec: currentSession.getSlotDurationSec(),
        slotExpiresAt: slotInfo ? slotInfo.expiresAt : null
    });
    return true;
}

function syncDeviceAssignmentFromTrackMessage(currentSession, msg) {
    if (!currentSession || !msg) {
        return;
    }

    const trackNumber = currentSession.getParticipantNumber(msg.socketID);
    if (trackNumber < 0) {
        return;
    }

    const nextDeviceId = msg.device && msg.device.id !== undefined ? msg.device.id : null;
    const currentAssignment = currentSession.getDeviceForTrack(trackNumber);

    // If another track is already marked with the same device, clear it first so the
    // server-side device map stays aligned with the sequencer's authoritative routing.
    if (nextDeviceId !== null) {
        for (const [assignedTrack, assignment] of Object.entries(currentSession.getDeviceAssignments())) {
            if (parseInt(assignedTrack, 10) !== trackNumber && assignment && assignment.deviceId === nextDeviceId) {
                currentSession.clearDeviceAssignment(parseInt(assignedTrack, 10));
            }
        }
    }

    if (nextDeviceId === null) {
        if (currentAssignment) {
            currentSession.clearDeviceAssignment(trackNumber);
        }
        return;
    }

    const initials = currentSession.getParticipantInitials(msg.socketID) || (currentAssignment ? currentAssignment.userInitials : '');
    currentSession.assignDeviceToTrack(
        trackNumber,
        nextDeviceId,
        msg.device.name || 'Unknown Device',
        initials
    );
}

function scheduleSlotExpiration(sessionName, currentSession, trackNumber, socketID, initials) {
    const slotInfo = currentSession.getTrackSlot(trackNumber);
    if (!slotInfo) {
        return;
    }

    clearTrackSlotTimeout(sessionName, trackNumber);
    const delayMs = Math.max(0, slotInfo.expiresAt - Date.now());
    const timeoutId = setTimeout(() => {
        const latestSession = sessions.select(sessionName);
        if (!latestSession) {
            return;
        }

        const latestSlot = latestSession.getTrackSlot(trackNumber);
        if (!latestSlot || latestSlot.socketID !== socketID) {
            return;
        }

        clearTrackSlotTimeout(sessionName, trackNumber);
        latestSession.releaseParticipant(socketID);

        io.to(sessionName).emit('track left', {
            track: trackNumber,
            initials: initials,
            socketID: socketID
        });

        emitDeviceAssignments(sessionName, latestSession);

        const timedOutSocket = io.sockets.sockets.get(socketID);
        if (timedOutSocket && timedOutSocket.connected) {
            timedOutSocket.emit('slot-expired', {
                reason: 'Your time is up. You have been moved to line.'
            });
            latestSession.enqueueWaitingUser(socketID, initials);
        }

        emitQueueUpdates(sessionName, latestSession);
        tryPromoteQueuedUsers(sessionName, latestSession, socketID);
        logger.info(`#${sessionName} @[${initials}] slot expired on track ${trackNumber}`);
    }, delayMs);

    slotTimeouts.set(getSlotTimeoutKey(sessionName, trackNumber), timeoutId);
}

function tryAssignSocketToTrack(sessionName, currentSession, socket, initials) {
    const safeInitials = (initials && `${initials}`.trim().length > 0) ? initials : 'GUEST';
    const availableDevice = currentSession.getRandomUnassignedDevice();
    if (!availableDevice) {
        return { assigned: false, reason: 'no-device' };
    }

    const track = currentSession.allocateAvailableParticipant(socket.id, safeInitials);
    if (track === -1) {
        return { assigned: false, reason: 'no-track' };
    }

    currentSession.assignDeviceToTrack(track, availableDevice.id, availableDevice.name, safeInitials);
    const expiresAt = Date.now() + (currentSession.getSlotDurationSec() * 1000);
    currentSession.setTrackSlot(track, socket.id, expiresAt);
    scheduleSlotExpiration(sessionName, currentSession, track, socket.id, safeInitials);

    io.to(sessionName).emit('track joined', {
        initials: safeInitials,
        track: track,
        socketID: socket.id
    });

    emitDeviceAssignments(sessionName, currentSession);
    emitQueueUpdates(sessionName, currentSession);
    emitTrackAssignment(sessionName, currentSession, socket.id, track);

    const sessionStarted = currentSession.getAttribute("isPlaying");
    if (sessionStarted) {
        io.to(socket.id).emit('veil-off', { socketID: socket.id });
    } else {
        io.to(socket.id).emit('veil-on', { socketID: socket.id });
    }

    return { assigned: true, track };
}

function tryPromoteQueuedUsers(sessionName, currentSession, excludedSocketID = null) {
    const deferredEntries = [];

    while (currentSession.getWaitingQueueLength() > 0) {
        if (currentSession.getAvailableParticipants().length === 0) {
            break;
        }
        if (!currentSession.getRandomUnassignedDevice()) {
            break;
        }

        const nextEntry = currentSession.dequeueWaitingUser();
        if (!nextEntry) {
            break;
        }

        if (excludedSocketID && nextEntry.socketID === excludedSocketID) {
            deferredEntries.push(nextEntry);
            continue;
        }

        const waitingSocket = io.sockets.sockets.get(nextEntry.socketID);
        if (!waitingSocket || !waitingSocket.connected) {
            continue;
        }

        const promoted = tryAssignSocketToTrack(
            sessionName,
            currentSession,
            waitingSocket,
            nextEntry.initials
        );

        if (!promoted.assigned) {
            currentSession.prependWaitingUser(nextEntry);
            break;
        }
    }

    deferredEntries.forEach(entry => {
        currentSession.enqueueWaitingUser(entry.socketID, entry.initials);
    });

    emitQueueUpdates(sessionName, currentSession);
}

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

app.get('/ambsynth', (req, res) => {
    var page = '/html/ambsynth.html';
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

app.get('/api/pedal-images', (req, res) => {
    try {
        const pedalsDir = __dirname + '/images/pedals';
        const entries = fs.readdirSync(pedalsDir, { withFileTypes: true });
        const allowedExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'];

        const images = entries
            .filter(entry => entry.isFile())
            .map(entry => entry.name)
            .filter(name => {
                const lower = name.toLowerCase();
                return allowedExtensions.some(ext => lower.endsWith(ext));
            })
            .sort((a, b) => a.localeCompare(b))
            .map(name => `/images/pedals/${name}`);

        res.json({ images });
    } catch (error) {
        logger.error(`Failed to list pedal images: ${error.message}`);
        res.status(500).json({ images: [], error: 'Failed to list pedal images' });
    }
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
        const sessionIndex = sessions.findSession(session);
        const hasSession = sessionIndex >= 0;
        const currentSession = hasSession ? sessions.select(session) : null;

        if (hasSession && currentSession && currentSession.getSeqID()) {
            io.to(socket.id).emit('sequencer exists', {
                reason: `Session '${session}' already has a sequencer. Choose a different name.`
            });
            logger.info(`#${session} @SEQUENCER exists already.`);
        } else {
            if (!hasSession) {
                sessions.addSession(session, config.NUM_TRACKS, config.NUM_STEPS, allocationMethod, config.MAX_NUM_ROUNDS);
                sessions.select(session).setAttribute("isPlaying", false);
            }

            sessions.select(session).setSeqID(socket.id);
            
            logger.info(`#${session} @SEQUENCER joined session.`);
            
            // Handle sequencer disconnection
            socket.on('disconnect', () => {
                logger.info(`#${session} @SEQUENCER disconnected. Session state preserved.`);
                const activeSession = sessions.select(session);
                if (activeSession) {
                    activeSession.clearSeqID();
                }
            });

            io.to(socket.id).emit('slot-duration-updated', {
                seconds: sessions.select(session).getSlotDurationSec()
            });

            emitDeviceAssignments(session, sessions.select(session));
            emitQueueUpdates(session, sessions.select(session));
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
        
        const hasQueueBacklog = currentSession.getWaitingQueueLength() > 0;
        const assignment = hasQueueBacklog
            ? { assigned: false, reason: 'queue-backlog' }
            : tryAssignSocketToTrack(session, currentSession, socket, initials);

        if (assignment.assigned) {
            logger.info(`#${session} @[${initials}] joined session on track ${assignment.track}`);
        } else {
            const position = currentSession.enqueueWaitingUser(socket.id, initials);
            emitQueueUpdates(session, currentSession);
            io.to(socket.id).emit('queue-status', {
                position,
                total: currentSession.getWaitingQueueLength(),
                message: `No pedals available right now. You are #${position} in line.`
            });

            const sessionStarted = currentSession.getAttribute("isPlaying");
            if (sessionStarted) {
                io.to(socket.id).emit('veil-off', { socketID: socket.id });
            } else {
                io.to(socket.id).emit('veil-on', { socketID: socket.id });
            }
            logger.info(`#${session} @[${initials}] queued at position ${position}`);
        }
        
        // Handle track disconnection
        socket.on('disconnect', () => {
            const trackToDelete = currentSession.getParticipantNumber(socket.id);
            if (trackToDelete >= 0) {
                clearTrackSlotTimeout(session, trackToDelete);
                currentSession.releaseParticipant(socket.id);

                io.to(session).emit('track left', {
                    track: trackToDelete,
                    initials: initials,
                    socketID: socket.id
                });

                emitDeviceAssignments(session, currentSession);
                tryPromoteQueuedUsers(session, currentSession);
                logger.info(`#${session} @[${initials}] (${socket.id}) disconnected, clearing track ${trackToDelete}`);
            }

            if (currentSession.removeWaitingUser(socket.id)) {
                emitQueueUpdates(session, currentSession);
                logger.info(`#${session} @[${initials}] (${socket.id}) left queue`);
            }
        });
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
            const trackNumber = currentSession.getParticipantNumber(socket.id);
            const assignment = trackNumber >= 0 ? currentSession.getDeviceForTrack(trackNumber) : null;

            if (assignment) {
                emitTrackAssignment(session, currentSession, msg.socketID, trackNumber);
                return;
            }

            if (currentSession.isUserQueued(socket.id)) {
                const position = currentSession.getQueuePosition(socket.id);
                io.to(msg.socketID).emit('queue-status', {
                    position,
                    total: currentSession.getWaitingQueueLength(),
                    message: `No pedals available right now. You are #${position} in line.`
                });
                return;
            }

            // No auto-assignment available (e.g., no configured devices or all in use)
            io.to(msg.socketID).emit('track-assignment', {
                socketID: msg.socketID,
                device: null,
                channel: 0,
                trackId: trackNumber >= 0 ? trackNumber.toString() : '-1',
                trackNumber: trackNumber >= 0 ? trackNumber + 1 : -1
            });
        } else {
            console.warn('No session found:', session);
        }
    });
    
    // Sequencer sends track assignment response - forward to specific track
    socket.on('track-assignment', (msg) => {
        console.log('Sequencer sending track assignment:', msg.socketID);
        const currentSession = sessions.select(session);
        if (currentSession && msg && msg.socketID) {
            const trackNumber = currentSession.getParticipantNumber(msg.socketID);
            if (trackNumber >= 0) {
                const slotInfo = currentSession.getTrackSlot(trackNumber);
                msg.slotDurationSec = currentSession.getSlotDurationSec();
                msg.slotExpiresAt = slotInfo ? slotInfo.expiresAt : null;
            }

            syncDeviceAssignmentFromTrackMessage(currentSession, msg);
            emitDeviceAssignments(session, currentSession);
        }

        // Forward assignment response directly to the requesting track
        io.to(msg.socketID).emit('track-assignment', msg);
    });
    
    // Sequencer sends configured devices list for auto-assignment
    socket.on('devices-configured', (msg) => {
        console.log('Sequencer configured devices:', msg.devices?.length || 0);
        const currentSession = sessions.select(session);
        if (currentSession) {
            currentSession.setConfiguredDevices(msg.devices || []);
            emitDeviceAssignments(session, currentSession);
            tryPromoteQueuedUsers(session, currentSession);
        }
    });

    socket.on('set-slot-duration', (msg) => {
        const currentSession = sessions.select(session);
        if (!currentSession) return;
        if (socket.id !== currentSession.getSeqID()) return;

        currentSession.setSlotDurationSec(msg.seconds);

        // Apply the new duration to currently active tracks as well.
        for (let trackNumber = 0; trackNumber < config.NUM_TRACKS; trackNumber++) {
            const slotInfo = currentSession.getTrackSlot(trackNumber);
            if (!slotInfo) continue;

            const participantInitials = currentSession.sequencer?.tracks?.[trackNumber]?.initials || 'UNKNOWN';
            const newExpiresAt = Date.now() + (currentSession.getSlotDurationSec() * 1000);
            currentSession.setTrackSlot(trackNumber, slotInfo.socketID, newExpiresAt);
            scheduleSlotExpiration(session, currentSession, trackNumber, slotInfo.socketID, participantInitials);
            emitTrackAssignment(session, currentSession, slotInfo.socketID, trackNumber);
        }

        io.to(currentSession.getSeqID()).emit('slot-duration-updated', {
            seconds: currentSession.getSlotDurationSec()
        });
        logger.info(`#${session} slot duration updated to ${currentSession.getSlotDurationSec()}s`);
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