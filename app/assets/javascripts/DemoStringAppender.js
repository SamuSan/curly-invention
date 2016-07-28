(function DemoStringAppender(){
  var self = this;
  self.stringIndex = 0;

  self.instruments  = [
    // //1
    // "def s = Synth.name(\"s\") wave(\"sine\") chord(\"\")\n" +
    // "def p = Performance.instrument(s) sequencer(\"\")",
    // //2
    // "def s = Synth.name(\"s\") wave(\"triangle\") chord(\"\")\n" +
    // "s.setEnvelopeRelease(2.0)\n" +
    // "s.insert(\"reverb\")\n" +
    // "s.insert(\"distortion\")\n\n" +
    // "def p = Performance.instrument(s) sequencer(\"\")",
    // //3
    // "def s = Synth.name(\"s\") wave(\"triangle\") chord(\"C-MAJ7\")\n" +
    // "def d = DrumMachine.name(\"rockbeat\")\n" +
    // "def dp = Part.instrument(d) rhythm(\"HOUSE_BEAT\")\n\n" +
    // "def seq = Sequencer.parts(list.with(dp))\n" +
    // "def p = Performance.instrument(s) sequencer(seq)",
    // //4
    // "def s = Synth.name(\"s\") wave(\"triangle\") chord(\"C-MAJ7\")\n" +
    // "def d = DrumMachine.name(\"rockbeat\")\n" +
    // "def dp = Part.instrument(d) rhythm(\"HOUSE_BEAT\")\n\n" +
    // "def lp = LoopPlayer.name(\"lp\" ) sample(\"sample_4\")\n" +
    // "def lpprt = Part.instrument(lp) rhythm(\"CLAVE\")\n\n" +
    // "def seq = Sequencer.parts(list.with(dp, lpprt))\n" +
    // "def p = Performance.instrument(s) sequencer(seq)",
    // //5
    // "def s = Synth.name(\"s\") wave(\"triangle\") chord(\"C-MAJ7\")\n" +
    // "def d = DrumMachine.name(\"rockbeat\")\n" +
    // "def dp = Part.instrument(d) rhythm(\"HOUSE_BEAT\")\n\n" +
    // "def lp = LoopPlayer.name(\"lp\" ) sample(\"sample_4\")\n" +
    // "def lpprt = Part.instrument(lp) rhythm(\"CLAVE\")\n\n" +
    // "def lpTwo = LoopPlayer.name(\"lpTwo\" ) sample(\"sample_7\")\n" +
    // "def lpprtTwo = Part.instrument(lpTwo) rhythm(\"ONE_BAR_LOOP\")\n\n" +
    // "def seq = Sequencer.parts(list.with(dp, lpprt, lpprtTwo))\n" +
    // "def p = Performance.instrument(s) sequencer(seq)"

    //Renaming Test
    "def s = Synth.wave(\"triangle\") chord(\"C-MAJ7\")\n" +
    "def d = DrumMachine.name(\"rockbeat\")\n" +
    "def dp = Part.instrument(d) rhythm(\"HOUSE_BEAT\")\n\n" +
    "def lp = LoopPlayer.sample(\"sample_4\")\n" +
    "def spart = Part.instrument(s) rhythm(\"CLAVE\")\n\n" +

    "def lpprt = Part.instrument(lp) rhythm(\"ONE_BAR_LOOP\")\n\n" +
    "def seq = Sequencer.parts(list.with(spart, lpprt, dp))\n" +
    "def p = Performance.instrument(s) sequencer(seq)"


  ]

  // self.infrastrucuture = [
  //   //1
  //   "def p = Performance.instrument(s) sequencer(\"\")",
  //   //2
  //   "def p = Performance.instrument(s) sequencer(\"\")",
  //   //3
  //   "def seq = Sequencer.parts(list.with(dp))\n" +
  //   "def p = Performance.instrument(s) sequencer(seq)",
  //   //4
  //   "def seq = Sequencer.parts(list.with(dp, lpprt))\n" +
  //   "def p = Performance.instrument(s) sequencer(seq)",
  //   //5
  //   "def seq = Sequencer.parts(list.with(dp, lpprt, lpprtTwo))\n" +
  //   "def p = Performance.instrument(s) sequencer(seq)"
  //   ];

  $(document).on("ready", function(){
    // $("#text-area").append(self.instruments[self.instruments.length - 1]);

    // $("#demo-string-button").on("click", function(e){
      // e.preventDefault();
      if(stringIndex < (self.instruments.length)){
        // var demoString =  "" + self.instruments[stringIndex] + "\n" +
        //                   self.infrastrucuture[stringIndex];
        $("#text-area").val(self.instruments[stringIndex]);
        // $("#text-area").append(self.instruments[stringIndex]);
        // $("#text-area").append("\n")
        // $("#text-area").append(self.infrastrucuture[stringIndex]);
        stringIndex++;
      }
    // });
  });
}).call(self);