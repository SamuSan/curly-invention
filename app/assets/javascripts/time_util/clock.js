$(function () {
    window.AudioEnvironment.Clock = function(){};
    var self = window.AudioEnvironment.Clock;
    var context = window.AudioEnvironment.context;
    var tempo = 120; // Classic default
    var minute = 60;
    var beat  = minute / tempo;

    self.currentTime = function(){
      return context.currentTime;
    }

    self.beat = function(){
      return beat;
    }

    self.eigth = function(){
      return beat / 2 ;
    }

    self.sixteenth = function(){
      return beat / 4;
    }

    self.tempo = function() {
      return tempo;
    }
});
