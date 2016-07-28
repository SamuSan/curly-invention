'use strict';

var Synth = function(wave, chord) {
  var self = this;
  Instrument.apply(self);

  var oscWaveform     = wave;
  var voices          = [];
  var onNotes         = {};
  var filterSettings  = { "frequency" : 1000, "type" : 'highpass', "Q" : 10 };
  var envSettings     = { "A" : 0.1, "S" : 0.11, "R" : 0.5 };
  var effectsInserted = false;
  var insertedEffects = [];
  var chord           = chord || null;
  var notes;
  chord ? notes = HarmonyUtil.chordFromName(chord) : notes = null;
  var oscPanValue     = 0;
  var voicePanValue   = 0;

  //**** Live play functions ****//
  self.noteOn = function(noteNumber){
    console.log("PLAYING A NOTES");
    var voice = new Osc(self.getContext(), oscWaveform, noteNumber);
    voice.init(envSettings);
    connectEffects(voice);
    voice.playNote();
    onNotes[noteNumber] = voice;
  }

 self.noteOff = function(noteNumber){
    onNotes[noteNumber].stopNote();
  }

  //**** Loop based functions ****//
  self.play = function(startTime, endTime) { //TODO reconsider this naming, couldbe called schedule gets called by playing
    self.createVoice();
    voices.forEach(function(voice) {
      voice.adjustPanning(voicePanValue);
      voice.play(startTime);
      voice.stop(endTime);
    });
  };

  self.stop = function(endTime) {
    voices.forEach(function(voice) {
      voice.stop(endTime);
    });
  };

  self.invertChord = function() {
    notes = HarmonyUtil.invertChord(notes);
  };

  self.insert = function(effectType) {
    console.log("creating effects with: " + effectType);
    insertedEffects.push(effectType);
    effectsInserted = true;
  };

  function connectEffects(voice) {
    if (effectsInserted) {
      insertedEffects.forEach(function(effectType){
        voice.connect(EffectFactory.createEffect(effectType));
      });
    }
  }

  self.setEnvelopeAttack = function(attackSetting) {
    envSettings["A"] = attackSetting;
  };

  self.setEnvelopeSustain = function(sustainSetting) {
    envSettings["S"] = sustainSetting;
  };

  self.setEnvelopeRelease = function(releaseSetting) {
    envSettings["R"] = releaseSetting;
  };

  self.pan = function(panValue) {
    oscPanValue = panValue;
  };

  Synth.prototype.createVoice = function() {
    voices = [];
    notes.forEach(function(note){
      var voice = new Osc(self.getContext(), oscWaveform, note);
      voice.init(envSettings);
      voices.push(voice)
    });
  };
}
