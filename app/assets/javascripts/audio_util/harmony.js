(function(){
  var nameSeperator = '-';
  var OCTAVE = 12;
  var tonalities = {
    'MAJ'   : [0, 4, 7],
    'MAJ7'  : [0, 4, 7, 9],
    'MAJ9'  : [0, 4, 7, 9, 11],
    'DOM7'  : [0, 4, 7, 8, 11],
    'MIN'   : [0, 3, 7],
    'MIN7'  : [0, 3, 7, 9],
    'MIN9'  : [0, 3, 7, 9, 11],
    'MIN11' : [0, 3, 7, 9, 11, 13],
    'DIM'   : [0, 3, 6],
    'AUG'   : [0, 4, 8],};

  var HarmonyUtil = {

    chordFromName: function (chordName) {
      var note = chordName.split(nameSeperator)[0].toUpperCase();
      var tonality = chordName.split(nameSeperator)[1].toUpperCase();
      var pitchGroup = "";
      note.length == 2 ? pitchGroup = "4" : pitchGroup = "-4";
      var noteNumber = MIDIUtils.noteNameToNoteNumber(note + pitchGroup);

      return constructChordNotes(noteNumber, tonality);
    },

    frequencyFromNoteNumber: function(number) {
      return MIDIUtils.noteNumberToFrequency(number);
    },

    invertChord: function (chord) {
      inverted = chord.slice(1);
      inverted.push(chord[0] + OCTAVE);
      return inverted;
    }
  };

  function constructChordNotes (noteNumber, tonality){
    var chord = [];
    tonalities[tonality].forEach(function(interval) {
      chord.push(noteNumber + interval);
    });
    return chord;
  }

  window.HarmonyUtil = HarmonyUtil;
}).call(this);