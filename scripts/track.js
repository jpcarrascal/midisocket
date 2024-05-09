var initials = findGetParameter("initials");
var session = findGetParameter("session");
if(session === "undefined") session = null;
if(initials === "undefined") initials = null;
setCookie("retries", 0, 1000);
var retries = 0;
var maxRetries = 3;
var progSelect = document.getElementById("select-program");

if(!initials && session) { // No initials == no socket connection
    document.getElementById("initials-form").style.display = "block";
    document.getElementById("initials").addEventListener("input", function(e) {
        this.value = this.value.toUpperCase();
    });
    document.getElementById("initials-form").addEventListener("submit", function(e) {
        e.preventDefault();
        initials = document.getElementById("initials").value.toUpperCase();
        document.getElementById("initials-form").style.display = "none";
        document.location.href = "/track?session=" + session + "&initials=" + initials;
    });
} else if(initials && session) {
    /* ----------- Socket set up: ------------ */
    document.getElementById("controller").style.display = "block";
    var mySocketID;
    var socket = io("", {query:{initials: initials, session: session}});
    socket.on("connect", () => {
        setCookie("retries", 0, 1000); retries = 0;
        console.log("Connected, my socketID:" + socket.id);
        mySocketID = socket.id;
        // Switch to a random instrument
        progSelect.value = progSelect.options[Math.floor(Math.random() * progSelect.options.length)].value;
        setTimeout(() => {
            progSelect.disabled = false;
            progSelect.dispatchEvent(new Event("change"));
        }, 500);
    });
    var body = document.querySelector("body");
    var noSleep = new NoSleep();

    /* ----------- Socket messages ------------ */

    socket.on('track data', function(msg) {
        if(msg.socketID == mySocketID) {
            console.log("My channel is: " + msg.channel);
            console.log("My color is: " + msg.colors[0]);
            document.querySelector("body").style.backgroundColor = msg.colors[0];
            document.querySelector("body").style.color = msg.colors[1];
        }
    });


    socket.on('stop', function(msg) {
        console.log("Remote stop! " + msg.socketID);
    });

    socket.on('play', function(msg) {
        console.log("Remote play! " + msg.socketID);
    });

    socket.on('exit session', function(msg) {
        if(retries < maxRetries) {
            console.log("Retrying...");
            retries = parseInt(getCookie("retries")) + 1;
            console.log("Retries: " + retries);
            console.log(document.cookie);
            setCookie("retries", retries, 1000);
            setTimeout(() => {
                window.location.reload(true);
            }, 1000);
        } else {
            console.log("Max retries reached. Exiting.");
            document.location.href = "/track?exitreason=" + msg.reason;
        }
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
    var mouseDown = 0;
    document.querySelectorAll(".key").forEach(function(key) {
        addListenerMulti(key, "touchstart mousedown", function(e) {
            ++mouseDown;
            e.preventDefault();
            var note = calculateNote(this);
            socket.emit("midi message", {type: "ui", message: [NOTE_ON, note, 127], socketID: mySocketID});
            this.style.backgroundColor = "lime";
        });

        addListenerMulti(key, "mouseup touchend mouseleave", function(e) {
            if(mouseDown > 0) {
                --mouseDown; if(mouseDown < 0) mouseDown = 0;
                e.preventDefault();
                var note = calculateNote(this);
                socket.emit("midi message", {type: "ui", message: [NOTE_OFF, note, 0], socketID: mySocketID});
                this.style.backgroundColor = "";
            }
        });
        /*
        key.addEventListener("mouseleave", function(e) {
            console.log("Mouse leave " + mouseDown);
            if(mouseDown > 0) {
                --mouseDown; if(mouseDown < 0) mouseDown = 0;
                e.preventDefault();
                var note = calculateNote(this);
                socket.emit("midi message", {type: "ui", message: [NOTE_OFF, note, 0], socketID: mySocketID});
            }
        });
        */
        
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

    progSelect.addEventListener("change", function(e) {
        var program = parseInt(this.value);
        socket.emit("midi message", {type: "ui", message: [P_CHANGE, program, 0], socketID: mySocketID});
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