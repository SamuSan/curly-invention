function Test() {
  var self = this;
  var rhy  = new RhythmUtil();
  var seq;
  var performance = null;

  self.startTest = function() {
    // var s = new Synth('saw', );
  }

  self.stopTest = function() {
    seq.stop();
    performance = null;
  }
}