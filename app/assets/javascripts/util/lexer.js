function Lexer (inputText) {
  var self = this;
  var inputText = inputText;
  var junkChars = ["", " ", "\n", "\""];
  var output = [];

  self.processInput = function () {
    inputLines = inputText.split('\n');
    inputLines.forEach(function(line){
      if(line.length > 0){
        output.push(line.split(' '));
      }
    });
    return output;
  };

  function stripJunk(input){
    strippedInput = []
    input.forEach(function(token){
      console.log(token);
      strippedInput.push(token.trim("\""))
    });
    return strippedInput;
  }
}