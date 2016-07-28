function Voice(note, waveform) {
  var self = this;

  var context     = window.AudioEnvironment.context;
  var note        = note;
  var waveform    = waveform;
  var GAIN_VALUE  = 0.3;

  var osc  = new Osc(context, waveform, note);
  var gain = context.createGain();
  var env  = new Envelope(GAIN_VALUE, context);

  self.trigger = function(startTime, endTime) {
    console.log('playing a thing')
      createOsc();
      // env.trigger();
      osc.play(startTime, endTime);
  }

  self.setADSR = function(settings) {
    env.set(settings);
  }

  function createOsc() {
    osc = new Osc(context, waveform, note);
    routeNodes();
  }

  function routeNodes() {
    // gain.value = GAIN_VALUE;
    // osc.connect(gain);
    // env.connect(gain.gain);
    // gain.connect(context.destination);
    osc.connect(context.destination);
  }
}