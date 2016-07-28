function Performance(instrument, sequencer) {
  var self = this;

  window.AudioEnvironment.Performance = self;
  var sequences = [];
  var playing_sequence;
  sequencer instanceof Sequencer ? playing_sequence = sequencer : playing_sequence = sequencer[0];

  if (instrument instanceof Synth) {
    var midi = window.AudioEnvironment.MidiController;
    midi.connectInstrument(instrument[0]);
  };

  if (playing_sequence instanceof Sequencer){
    sequences.push(playing_sequence);
    playing_sequence.init();
    playing_sequence.run();
  }

  function runSequence() {
    playing_sequence.init();
    playing_sequence.run();
  }
  //Add a sequencer to the collection of sequences for this performance
  //returns the index of the new sequencer
  self.enqueue = function(sequencer) {
    sequences.push(sequencer);
    return sequences.indexOf(sequencer);
  }
  //Play the next available sequence in the queues
  self.nextSequence = function() {
    //No next sequence do nothing, return false
    if(sequences.length === 1){ return false; }
    //Stop current playing seq
    playing_sequence.stop();
    //Start next sequence
    playing_sequence = sequences[sequences.indexOf(playing_sequence) + 1];
    runSequence();
    return true;
  }
  //Change to [index] sequence
  self.change = function(index, legato) {
    if(index < 0 || index >= sequences.length || index === undefined){ return false; }
    //Stop current playing seq
    playing_sequence.stop();
    //Start next sequence
    playing_sequence = sequences[index];
    runSequence();
    return true;
  }
  //Stop this performance and remove itself from the window context.
  self.stop  = function() {
    if(playing_sequence instanceof Sequencer){
      playing_sequence.stop();
    }
    window.AudioEnvironment.Performance = null;
  }
}