var initials = findGetParameter("initials");
var session = findGetParameter("session");
if(session === "undefined") session = null;
if(initials === "undefined") initials = null;

if(!initials && session) { // No initials == no socket connection
    document.getElementById("initials-form").style.display = "block";
    document.getElementById("initials-form").addEventListener("submit", function(e) {
        e.preventDefault();
        initials = document.getElementById("initials").value;
        document.getElementById("initials-form").style.display = "none";
        document.location.href = "/track?session=" + session + "&initials=" + initials;
    });
} else if(initials && session) {
    /* ----------- Socket set up: ------------ */
    document.getElementById("controller").style.display = "block";
    var mySocketID;
    var socket = io("", {query:{initials: initials, session: session}});
    socket.on("connect", () => {
        console.log("Connected, my socketid:" + socket.id);
        mySocketID = socket.id;
    });
    var body = document.querySelector("body");
    var noSleep = new NoSleep();

    /* ----------- Socket messages ------------ */
    socket.on('stop', function(msg) {
        console.log("Remote stop! " + msg.socketID);
    });

    socket.on('play', function(msg) {
        console.log("Remote play! " + msg.socketID);
    });

    socket.on('exit session', function(msg) {
        setTimeout(() => {
            window.location.reload(true);
        }, 1000);
    });

    // Veil for preventing people from joining earlier than intended.
    socket.on('veil-on', function(msg) {
        console.log("Veil ON " + msg.socketID);
        document.getElementById("veil").style.display = "flex";
    });

    socket.on('veil-off', function(msg) {
        console.log("Veil OFF " + msg.socketID);
        document.getElementById("veil").style.display = "none";
    });

    /* ----------- UI handlers ------------ */

    document.querySelectorAll(".key").forEach(function(key) {
        addListenerMulti(key, "touchstart mousedown", function(e) {
            e.preventDefault();
            var note = calculateNote(this);
            console.log("Note ON: " + note);
            socket.emit("midi message", {type: "ui", message: [NOTE_ON, note, 127], socketID: mySocketID});
        });

        addListenerMulti(key, "mouseup mouseleave touchend", function(e) {
            e.preventDefault();
            var note = calculateNote(this);
            console.log("Note OFF: " + note);
            socket.emit("midi message", {type: "ui", message: [NOTE_OFF, note, 0], socketID: mySocketID});
        });
        
    });

    document.querySelectorAll(".oct").forEach(function(oct) {
        addListenerMulti(oct, "touchstart mousedown", function(e) {
            e.preventDefault();
            if(this.id == "oct-up") {
                console.log("Octave up");
                document.querySelectorAll(".key").forEach(function(key) {
                    var oct = parseInt(key.getAttribute("octave"));
                    if(oct < 9) key.setAttribute("octave", oct + 1);
                });
            } else {
                console.log("Octave down");
                document.querySelectorAll(".key").forEach(function(key) {
                    var oct = parseInt(key.getAttribute("octave"));
                    if(oct > 0) key.setAttribute("octave", oct - 1);
                });
            }
        });

    });

    function calculateNote(elem) {
        var note = parseInt(elem.getAttribute("note"));
        var octave = parseInt(elem.getAttribute("octave"));
        return note + (12 * octave);
    }

    function addListenerMulti(el, s, fn) {
        s.split(' ').forEach(e => el.addEventListener(e, fn, false));
    }

}