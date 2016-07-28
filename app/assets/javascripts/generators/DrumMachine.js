function DrumMachine() {
  var self = this;
  Instrument.apply(self);

  var drums = {};
  init();

  self.hithat = drums['hat'];
  self.snare  = drums['snare'];
  self.kick   = drums['kick'];

  self.drums = function(){
    var samplers = [];
    for(var key in drums){
      console.log(key);
      samplers.push(drums[key]);
    }
    return samplers;
  }
    //TODO add a drum
  self.addDrum = function() {
    console.log('not yet implemented');
  }

  //Private
  function init() {
    drums['hat']   = new Sampler('hat', null, window.AudioEnvironment.sampleBuffers['hat']);
    drums['snare'] = new Sampler('snare', null, window.AudioEnvironment.sampleBuffers['snare']);
    drums['kick']  = new Sampler('kick', null, window.AudioEnvironment.sampleBuffers['kick']);
  }
}