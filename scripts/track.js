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
        key.addEventListener("click", function(e) {
            var note = parseInt(this.getAttribute("note"));
            socket.emit("midi message", {type: "ui", message: [-1, note, -1], socketID: mySocketID});
        });
    });

}