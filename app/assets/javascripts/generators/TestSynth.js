'use strict';

var TestSynth = function (id, waveform, chord) {
  Instrument.apply(this, arguments);
  var self = this;
  var id = id;
  var oscWaveform = waveform;
  var oscillators = [];
  var notes = HarmonyUtil.chordFromName(chord);

  self.play = function (time){
    console.log("playing" + time);
  }

  self.stop = function (time) {
   console.log("stopping" + time);
  }
}