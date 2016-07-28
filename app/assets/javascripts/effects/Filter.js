function Filter (settings) {
  var self = this;
  Effect.apply(self, [name]);
  self.filter = self.getContext().createBiquadFilter();
  self.filter.frequency.value = settings["frequency"];
  self.filter.Q.value = settings["Q"];
  self.filter.type = settings["type"];


  self.setFrequency = function(frequency) {
    self.filter.frequency.value  = frequency;
  }

  self.setQ = function(Q) {
    self.filter.Q.value  = Q;
  }

  self.setType = function(type) {
    self.filter.type = type;
  }

  self.connect = function(node) {
    self.filter.connect(node);
  }
}
