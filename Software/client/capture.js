// GLOBAL VARIABLES //
let mode = true, rec = false, pb = false;
let attenuation = 0, offset = 0, maxAttenuation = 20, border = 0.5;
let startAtt, startOff, startMode;
let width = main.clientWidth, height = main.clientHeight;
let ev;
let posX, posY;
let recording = new Array();
const pointer = document.getElementById("pointer");
const range = document.getElementById("range");
let timeouts = new Array(), interval;
function EventData(type, buttons, clientX, clientY, deltaY, timeStamp) {
    this.type = type;
    this.buttons = buttons;
    this.clientX = clientX;
    this.clientY = clientY;
    this.deltaY = deltaY;
    this.timeStamp = timeStamp;
}

// TODO :
// Issue: attenuation problem in playback


addListeners();

function handleMouseMove(e) {
    posX = e.clientX;
    posY = height - e.clientY;
    ev = new EventData(e.type, e.buttons, e.clientX, height - e.clientY, e.deltaY, e.timeStamp);
    move(ev);
}

function handleMouseDown(e) {
    e.preventDefault();
    ev = new EventData(e.type, e.buttons, e.clientX, height - e.clientY, e.deltaY, e.timeStamp);
    mouseDown(ev);
}

function handleMouseUp(e) {
    e.preventDefault();
    if (e.button !== 2) return;
    ev = new EventData(e.type, e.button, e.clientX, height - e.clientY, e.deltaY, e.timeStamp);
    gate(ev);
}

function handleWheel(e) {
    //e.preventDefault();
    ev = new EventData(e.type, e.buttons, e.clientX, height - e.clientY, e.deltaY, e.timeStamp);
    wheel(ev);
}

function handleKeyDown(e) {
    if (e.key === "r" || e.key === "R") {
        console.log(e);
        ev = new EventData("mousedown", 16, posX, posY, 0, e.timeStamp);
        record(ev);
    }
    else if (e.key === "e" || e.key === "E") {
        erase();
    }
}

function addListeners() {
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("wheel", handleWheel);

    // Only for debug
    document.addEventListener("keydown", handleKeyDown);
    removed = false;
}

function removeListeners() {
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mousedown", handleMouseDown);
    document.removeEventListener("mouseup", handleMouseUp);
    document.removeEventListener("wheel", handleWheel);
    document.removeEventListener("keydown", handleKeyDown);

    document.addEventListener("mousedown", handleErase);
    // Only for debug
    document.addEventListener("keydown", handleEraseKey);

    removed = true;
}

function handleErase(e) {
    e.preventDefault();
    if (e.buttons === 8) {
        erase();
    }
    else if (e.buttons === 16) {
        erase();
        ev = new EventData("mousedown", 16, e.clientX, height - e.clientY, 0, e.timeStamp);
        record(ev);
    }
}

function handleEraseKey(e) {
    if (e.key === "e" || e.key === "E") {
        erase();
    }

    // This is not working properly
    else if (e.key === "r" || e.key === "R") {
        erase();
        ev = new EventData("mousedown", 16, width/2, height/2, 0, e.timeStamp);
        record(ev);
    }
}

function move(e) {
    constrain(e); 
    document.getElementById("coordinates").innerHTML =
        "X: " + (e.clientX / width - 0.5) + ", Y: " + (e.clientY / height - 0.5);
    pointer.style.bottom = (e.clientY - 5) + "px";
    pointer.style.left = (e.clientX - 5) + "px";
    if (rec) {
        recording.push(e);
    }
    sendServer(e);
}

function constrain(e) {
    let x = e.clientX/width - 0.5;
    let y = e.clientY/height - 0.5;
    let max = border + (offset / (maxAttenuation * 2));
    let min = -border + (offset / (maxAttenuation * 2));
    if (x > max)
        x = max;
    else if (x < min)
        x = min;
    e.clientX = (x+0.5)*width;

    if (y > max)
        y = max;
    else if (y < min)
        y = min;
    e.clientY = (0.5+y)*height;
}

function mouseDown(e) {
    var button = e.buttons;
    if (button === 1) {
        trigger(e);
    }
    else if (button === 2) {
        gate(e)
    }
    else if (button === 4) {
        changeMode(e);
    }
    else if (button === 8) {
	    erase();
    }
    else if (button === 16) {
        record(e);
    }
    else debug(button);
}

function trigger(e) {
    if (rec) {
        recording.push(e);
    }
    debug("TRIGGER PULSE");
    sendServer(e)
    .then((res) => {console.log("response: " + res)})
    .catch((err) => {console.warn(err)});
}

function gate(e) {
    if (rec)
        recording.push(e);
    if (e.type === "mousedown") {
        debug("GATE ON");
    }
    else {
        debug("GATE OFF");
    }
    sendServer(e)
    .then((res) => {console.log("response: " + res)})
    .catch((err) => {console.warn(err)});
}

function changeMode(e) {
    if (rec)
        recording.push(e);
    mode = !mode;
    debug("CHANGE MODE TO " + (mode ? "ATTENUATION" : "OFFSET"));
    sendServer(e);
}

function record(e) {
    rec = !rec;
    if (!rec && recording.length !== 0) {
        removeListeners();
        playback();
    }
    else { // start recording
        startAtt = attenuation;
        startOff = offset;
        startMode = mode;
        recording.push(e);
    }
    debug(rec ? "START RECORDING" : "PLAYBACK");
}

function erase() {
    if (rec)
        rec = false;
    for (let i = 0; i < timeouts.length; i++) {
        clearTimeout(timeouts[i]);
    }
    clearInterval(interval);
    recording.splice(0,recording.length);

    if (removed) {
        // remove listeners inserted in playback mode
        document.removeEventListener("mousedown", handleErase);
        document.removeEventListener("keydown", handleEraseKey);
        // add standard listeners
        addListeners();
    }

    pb = false;
    debug("ERASE");
}

function playback() {
    pb = true;
    animationPlayback();
    interval = setInterval(animationPlayback, (recording[recording.length-1].timeStamp - recording[0].timeStamp));
}

function animationPlayback() {
    attenuation = startAtt; // ISSUE TO SOLVE
    offset = startOff;
    mode = startMode;
    move(recording[0]);
    timeouts.push(recursiveTimeout(1));
}

function recursiveTimeout(i) {
    if (i<recording.length) {
        setTimeout(function() {
            try {
                playbackEventHandler(recording[i]);
            }
            catch(error) {
                console.warn(error);
            }
            timeouts.push(recursiveTimeout(i+1));
        }, (recording[i].timeStamp - recording[i-1].timeStamp));
    }
}

function playbackEventHandler(e) {
    let type = e.type;
    if (type === "mousemove") {
        move(e);
    }
    else if (type === "mousedown") {
        if (e.buttons !== 16)
            mouseDown(e);
    }
    else if (type === "mouseup") {
        if (e.buttons !== 2) return;
        gate(e);
    }
    else if (type === "wheel") {
        wheel(e);
    }
    else console.warn("ERROR: Event not recognized");
}

function debug(message) {
    var tag = document.createElement("p");
    var text = document.createTextNode(message);
    tag.appendChild(text);

    var element = document.getElementById("console");
    if (element.firstChild != null)
        element.removeChild(element.firstChild);
    element.appendChild(tag);
}

function wheel(e) {
    var message;
    if (e.deltaY > 0) {
        if (mode) {
            if (attenuation > -maxAttenuation) {
                message = "Attenuation: " + (--attenuation);
                sendServer(e);
            }
            else message = "Attenuation: " + (attenuation);
        }
        else {
            if (offset > attenuation) {
                message = "Offset: " + (--offset);
                sendServer(e);
            }
            else message = "Offset: " + (offset);
        }
    }
    else {
        if (mode) {
            if (attenuation < (-Math.abs(offset))) {
                message = "Attenuation: " + (++attenuation);
                sendServer(e);
            }
            else message = "Attenuation: " + (attenuation);
        }
        else {
            if (offset < -(attenuation)) {
                message = "Offset: " + (++offset);
                sendServer(e);
            }
            else message = "Offset: " + (offset);
        }
    }
    changeRange(e);
    debug(message);
}

function changeRange(e) {
    //console.log("start = " + startAtt);
    //console.log("attenuation = " + attenuation);
    border = 0.5 + (attenuation / (maxAttenuation * 2));
    move(e);
    let att = (maxAttenuation + attenuation) * (100/maxAttenuation);
    range.style.width = att + "%";
    range.style.height = att + "%";

    let off = offset * (100/maxAttenuation);
    range.style.bottom = ((100-att)/2 + off/2) + "%";
    range.style.left = ((100-att)/2 + off/2) + "%";
}

function sendServer(data) {
    const options = {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
    }
    async function communicate() {
        const response = await fetch("/", options);
        const text = await response.text();
        return text; //this return a promise so in order to get it when it's resolved we have to use '.then()'
    }
    return communicate()
}