$(function(){
  var fileNames = ['kick',
                   'snare',
                   'hat',
                   'sample_1',
                   'sample_2',
                   'sample_3',
                   'sample_4',
                   'sample_5',
                   'sample_6',
                   'sample_7',
                   'sample_8',
                   'verb_impulse'];

  var sampleFiles   = [ window.FileUtils.fileLocation("kick"),
                        window.FileUtils.fileLocation("snare"),
                        window.FileUtils.fileLocation("hat"),
                        window.FileUtils.fileLocation("sample_1"),
                        window.FileUtils.fileLocation("sample_2"),
                        window.FileUtils.fileLocation("sample_3"),
                        window.FileUtils.fileLocation("sample_4"),
                        window.FileUtils.fileLocation("sample_5"),
                        window.FileUtils.fileLocation("sample_6"),
                        window.FileUtils.fileLocation("sample_7"),
                        window.FileUtils.fileLocation("sample_8"),
                        window.FileUtils.fileLocation("verb_impulse")];

  console.log("Loading Audio Environment")
  window.AudioEnvironment = function(){};
  window.AudioEnvironment.context = new window.AudioContext();
  if(!window.AudioEnvironment.context){
    window.AudioEnvironment.context = new window.webkitAudioContext();
  }

  if (!window.AudioEnvironment.context.createGain)
    window.AudioEnvironment.context.createGain = context.createGainNode;
  if (!window.AudioEnvironment.context.createDelay)
    window.AudioEnvironment.context.createDelay = context.createDelayNode;
  if (!window.AudioEnvironment.context.createScriptProcessor)
    window.AudioEnvironment.context.createScriptProcessor = context.createJavaScriptNode;

  window.AudioEnvironment.sampleBuffers = {};

  function setUpSampleBuffers() {
    for (var i = sampleFiles.length - 1; i >= 0; i--) {
      window.AudioEnvironment.sampleBuffers[fileNames[i]] =
      window.AudioEnvironment.loadSampleFile(sampleFiles[i], i);
    };
  }

  window.AudioEnvironment.loadSampleFile = function(file, idx) {
    var request = new XMLHttpRequest();
    request.open("GET", file, true);
    request.responseType = "arraybuffer";

    request.onload = function() {
      window.AudioEnvironment.context.decodeAudioData(request.response, function(buffer) {
          var sampleBuffer    = window.AudioEnvironment.context.createBufferSource();
          sampleBuffer.buffer = buffer;
          window.AudioEnvironment.sampleBuffers[fileNames[idx]] = sampleBuffer;
          // console.log(window.AudioEnvironment.sampleBuffers);
        });
      };
    request.send();
  }

 setUpSampleBuffers();
});