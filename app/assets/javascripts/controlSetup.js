$(function(){
  var started = false;
  var t = null;
  var hopperWrapper = null;

  $('#play-button').on('click', function(e){
    e.preventDefault();
    $("#error-div").text("");
    $('#play-button').addClass('disabled');
    $('#stop-button').removeClass('disabled');
    var input = $('#text-area').val();
    hopperWrapper = new HopperWrapper();
    hopperWrapper.interpret(input);
  });

  $('#stop-button').on('click', function(e){
    e.preventDefault();
    $('#play-button').removeClass('disabled');
    $('#stop-button').addClass('disabled');
    window.AudioEnvironment.Performance.stop();
  });

  $('#man-button').on('click', function(e){
    e.preventDefault();
    window.open(window.FileUtils.fileLocation("docs"), '_blank');
    window.open(window.FileUtils.fileLocation("expproc"), '_blank');
  });

  $('#done-button').on('click', function(e){
    e.preventDefault();
    window.open("http://goo.gl/forms/sDvXoR8nbY", '_blank');
  });

  $('#noteoff-button').on('click', function(e){
    e.preventDefault();
    $("#error-div").addClass('info-text');
    $("#error-div").text(window.AudioEnvironment.MidiController.toggleNoteOffThres());

  });


});
