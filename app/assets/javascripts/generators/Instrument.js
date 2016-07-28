"use strict";

function Instrument () {
  var self = this;
  var audioContext = window.AudioEnvironment.context;
  var name = window.RandomNameGenerator.randomName();

  self.getContext = function(){
    return audioContext;
  }

  self.name = function() {
    return name;
  }
}


