function Part(generator, rhythm) {
  var self = this;
  if(generator instanceof Array){
    self.generator = generator[0];
  }
  else{
    self.generator = generator;
  }
  if(rhythm instanceof Array){
    self.rhythm    = rhythm;
  }
  else{
    self.rhythm    = new RhythmUtil().getRhythmConstant(rhythm);
  }
}