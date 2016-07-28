'use strict'

function Osc (context, waveform, note) {
  var self = this;
  self.waveform   = waveform;
  self.frequency  = MIDIUtils.noteNumberToFrequency(note);
  var oscillator  = null;
  var gain        = null;
  var GAIN_VALUE  = 0.05;
  var env         = new Envelope(GAIN_VALUE, context);
  var pan         = null;
  var panning     = 0;


  self.init = function(envSettings) {
    env.setASR(envSettings);
    createVoice();
  }

//Live functions
  self.playNote = function() {
    env.triggerOn();
    oscillator.start();
  };

  self.stopNote = function() {
    oscillator.stop(env.triggerOff());
  };

//Loopbased functions
  self.play = function(startTime) {
    env.triggerOn();
    oscillator.start(startTime);
  };

  self.stop = function(endTime) {
    oscillator.stop(endTime);
  };

  self.connect = function(node) {
    gain.connect(node);
    node.connect(pan);
  };

  self.adjustPanning = function(panValue) {
    panning = panValue;
  }

  self.setASR = function(settings) {
    envAsr = settings;
  };

  function createVoice() {
    initOscillator();
    routeNodes();
  };

  function initOscillator() {
    oscillator = context.createOscillator();
    oscillator.frequency.value = self.frequency;
    oscillator.type = self.waveform;
  };

  function routeNodes() {
    gain = context.createGain();
    pan  = context.createStereoPanner();

    pan.pan.value = panning;
    gain.value = GAIN_VALUE;

    oscillator.connect(gain);
    env.connect(gain.gain);
    gain.connect(pan);
    pan.connect(context.destination);
  };
}