const NUM_TRACKS = config.NUM_TRACKS;
const MAX_NUM_ROUNDS = config.MAX_NUM_ROUNDS;

const NOTE_ON = 0x90;
const NOTE_OFF = 0x80;
const CC_CHANGE = 0xB0;
const P_CHANGE = 0xC0;
const NOTE_DURATION = 300;
const DEFAULT_SESSION = 999;
const EMPTY_COLOR = "#AAA";
const MAX_OCTAVE = 6;
const MIN_OCTAVE = 1;
const MID_OCTAVE = 3;
const SYNTH_DEFAULT_VEL = 63;
const colors = ["#666666","#777777","#888888","#999999","#aaaaaa","#bbbbbb","#cccccc","#dddddd","#333333","#444444","#555555"];
/*
36. Kick Drum
38. Snare Drum
39. Hand Clap
41. Floor Tom 2
42. Hi-Hat Closed
43. Floor Tom 1
45. Low Tom
46. Hi-Hat Open
49. Crash Cymbal
*/
const drumNotes = [36, 38, 39, 41, 43, 45, 42, 46];
const onColor = "rgb(128,128,128)";
const offColor = "white";
var mouseStepDownVal = 0;

function getMidiMessageType(firstByte) {
  const messageType = firstByte & 0xF0;
  switch (messageType) {
    case 0x80:
      return 'NOTE_OFF';
    case 0x90:
      return 'NOTE_ON';
    case 0xB0:
      return 'CC_CHANGE';
    case 0xC0:
      return 'P_CHANGE';
    case 0xE0:
      return 'PITCH_BEND';
    default:
      return 'OTHER';
  }
}

function replaceMidiChannel(message, channel) {
  if(channel < 0 || channel > 15){
    return message;
  }
  console.log("replacing channel");
  message[0] = (message[0] & 0xF0) + channel;
  return message;
}

function debugMidiMessage(message) {
  console.log("Type: " + getMidiMessageType(message[0]) + " CH: " + (message[0] & 0x0F) + " Data: " + message[1] + ", " + message[2]);
}

/* ----------- Helper Functions ------------ */

// Cookies, from: https://stackoverflow.com/questions/14573223/set-cookie-and-get-cookie-with-javascript
function setCookie(name, val, days) {
    var expires = "";
    if (days) {
        var date = new Date();
        date.setTime(date.getTime() + (days*24*60*60*1000));
        expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + (val || "")  + expires + "; path=/";
}
function getCookie(name) {
    var nameEQ = name + "=";
    var ca = document.cookie.split(';');
    for(var i=0;i < ca.length;i++) {
        var c = ca[i];
        while (c.charAt(0)==' ') c = c.substring(1,c.length);
        if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
    }
    return null;
}
function eraseCookie(name) {   
    document.cookie = name +'=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
}

// GET parameter access, from: https://stackoverflow.com/questions/5448545/how-to-retrieve-get-parameters-from-javascript

function findGetParameter(parameterName) {
  var result = null,
      tmp = [];
  location.search
      .substr(1)
      .split("&")
      .forEach(function (item) {
        tmp = item.split("=");
        if (tmp[0] === parameterName) result = decodeURIComponent(tmp[1]);
      });
  return result;
}

function copyURL(id) {
  var copyText = document.getElementById(id); /* Needs to be text area or input */
  copyText.select();
  copyText.setSelectionRange(0, 99999); /* For mobile devices */
  navigator.clipboard.writeText(copyText.value);
}

function isElemInDropdown(select, elem) {
  for (i = 0; i < select.length; ++i){
    if (select.options[i].value == elem.value){
      return true;
    }
  }
  return false;
}