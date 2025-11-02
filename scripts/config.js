// From: https://gist.github.com/drmikecrowe/4bf0938ea73bf704790f
'use strict';

(function(window){
    var config = {
        NUM_TRACKS      : 100,
        NUM_DRUMS      : 8,
        NUM_STEPS       : 16,
        MAX_NUM_ROUNDS  : 20,
        // Device Configuration
        MAX_CONTROLLERS_PER_DEVICE : 6,  // Change this to 6 to allow more CCs per device
        // MIDI Configuration
        MIDI_CC_MIN     : 0,      // Minimum MIDI CC value
        MIDI_CC_MAX     : 127,    // Maximum MIDI CC value
        DEFAULT_MIDI_VALUE : 64,  // Default/center MIDI value
        DEFAULT_VOLUME  : 127,    // Default MIDI volume
        DEFAULT_CC_RANGE : '0-127' // Default continuous controller range
    };
    if ( typeof module === 'object' && module && typeof module.exports === 'object' ) {
        module.exports = config;
    } else {
        window.config = config;
    }
})( this );
