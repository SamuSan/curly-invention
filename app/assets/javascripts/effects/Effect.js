"use strict";

function Effect (name) {
  var self = this;
  var audioContext = window.AudioEnvironment.context;

  self.getContext = function(){
    return audioContext;
  }
}
