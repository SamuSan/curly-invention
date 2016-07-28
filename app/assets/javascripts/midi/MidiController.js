function MidiController(midiConnection) {
  var self = this;
  var connection =  midiConnection;
  startLoggingMIDIInput(connection, null);
  var instrumentConnected = false;
  var instrument;
  var noteOffThresh = 65;

  self.connectInstrument = function(inst) {
    instrument = inst;
    instrumentConnected = true;
  }

  function onMIDIMessage( event ) {
    if(instrumentConnected){
      if(event.data[2] > noteOffThresh){
          instrument.noteOn(event.data[1]);
      }
      else{
          instrument.noteOff(event.data[1]);
      }
    }
  }

  function startLoggingMIDIInput( connection, indexOfPort ) {
    connection.inputs.forEach( function(entry) {entry.onmidimessage = onMIDIMessage;});
  }

  self.toggleNoteOffThres = function(){
    console.log("Current note off val: " + noteOffThresh);
    noteOffThresh === 65 ? noteOffThresh = 0 : noteOffThresh = 65;
    console.log("Note off value changed to: " + noteOffThresh);
    return "Note off threshold changed to: " + noteOffThresh;
  }
}