$(function () {
  window.AudioEnvironment.midi = null;

  function onMidiSucess (midiAccess) {
    console.log("Midi connected");
    window.AudioEnvironment.midi = midiAccess;
    window.AudioEnvironment.MidiController = new MidiController(window.AudioEnvironment.midi)
  }

  function onMidiFailure(message){
    console.log(message);
  }
  navigator.requestMIDIAccess().then(onMidiSucess, onMidiFailure);
});