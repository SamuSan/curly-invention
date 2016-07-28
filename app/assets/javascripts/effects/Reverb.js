function Reverb() {
  var self = this;
  Effect.apply(self);
  var reverb = self.getContext().createConvolver();
  reverb.buffer = window.AudioEnvironment.sampleBuffers['verb_impulse'].buffer;
  return reverb;
}