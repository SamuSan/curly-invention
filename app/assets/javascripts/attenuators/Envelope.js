var Envelope = function(amplitude, context) {
  var self = this;

  var amplitude = amplitude;
  var DEFAULT_ATTACK_SETTING  = 0.01;
  var DEFAULT_RELEASE_SETTING = 1.1;

  self.attackTime   = DEFAULT_ATTACK_SETTING;
  self.sustainTime  = 0.1;
  self.releaseTime  = DEFAULT_RELEASE_SETTING;
  var parma = null;

  self.connect = function(parmameter) { //Intentionally spelled wrong, I like ham.
    parma = parmameter;
  }

  self.triggerOn = function() { 
    var now = context.currentTime;
    parma.cancelScheduledValues(now);
    parma.setValueAtTime(0, now);
    parma.linearRampToValueAtTime(amplitude, now + self.attackTime);
    // parma.linearRampToValueAtTime(0, now + self.sustainTime + self.releaseTime);
  }

  self.triggerOff = function() { 
    var now = context.currentTime;
    parma.cancelScheduledValues(now);
    parma.linearRampToValueAtTime(0, now + self.releaseTime);
    return now + self.releaseTime;
  }


  self.setASR = function (settings) { // TODO ask are optionals and hash args ok in Grace
    self.attackTime = settings["A"] || self.attackTime;
    self.sustainTime = settings["S"] || self.sustainTime;
    self.releaseTime = settings["R"] || self.releaseTime;
  }
}