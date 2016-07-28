function Panner(sourceNode) {
  var self = this;
  var context = window.AudioEnvironment.context;
  var panningNode = context.createStereoPanner();

  sourceNode.connect(panningNode);
  panningNode.connect(connext.destination);

  sourceNode.pan = function(panValue) {
    if(validPanValue(panValue)){
      panningNode.pan.value = panValue;
    }
  }

  sourceNode.currentPan = function() {
    return panningNode.pan.value;
  }

  function validPanValue(panValue) {
    return panValue > -1 && panValue < 1;
  }
}