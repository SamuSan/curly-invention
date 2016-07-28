function Sampler(name, fileName, buffer) {
  var self = this;
  Instrument.apply(self);

  var name = name;
  var loaded        = false;
  var playing       = false;
  var file          = window.FileUtils.fileLocation(fileName);
  var audioBuffer   = buffer.buffer || null;
  self.sampleBuffer = null;

  audioBuffer ? assignBuffer() : loadSampleFile(file);

  self.sampleLength = function() {
    return sampleBuffer.duration();
  }

  self.syncWithTempo = function() {
    var clock = window.AudioEnvironment.Clock;
    var numberOfBeats = duration() / clock.beat();

    updatePlayRate(16 / numberOfBeats);
    numberOfBeats = duration() / clock.beat();
  }

  self.play = function(startTime, endTime) {
    if(loaded){
      playing = !playing;
      assignBuffer();
      self.sampleBuffer.start(startTime);
      console.log('playing');
    }
  }

  self.stop = function() {
    if(playing){
      self.sampleBuffer.stop();
    }
  }

  self.name = function(){
    return name;
  }
  //Private
  function updatePlayRate(rate) {
    self.sampleBuffer.playbackRate.value = rate;
  }

  function duration() {
    return self.sampleBuffer.buffer.duration;
  }

  function loadSampleFile(file) {
    var request = new XMLHttpRequest();
    request.open("GET", file, true);
    request.responseType = "arraybuffer";

    request.onload = function() {
      window.AudioEnvironment.context.decodeAudioData(request.response, function(buffer) {
          audioBuffer = buffer;
          self.sampleBuffer = self.getContext().createBufferSource();
          self.sampleBuffer.buffer = audioBuffer;
          loaded = true;
        });
      };
    request.send();
  }

  function assignBuffer() {
    loaded = true;
    self.sampleBuffer = self.getContext().createBufferSource();
    self.sampleBuffer.buffer = audioBuffer;
    self.sampleBuffer.connect(self.getContext().destination);
  }
}