window.RandomNameGenerator = new function () {
  var self = this;
  self.randomName = function() {
      length = 50;
      var baseString = Math.round((Math.pow(36, length + 1) - Math.random() * Math.pow(36, length)));
      return baseString.toString(36).slice(1);
  }
}