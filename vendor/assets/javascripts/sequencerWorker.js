var self = this;
var timeOutID = null;
var schedulingLookAhead = 100.0;

self.onmessage = function(e) {

  if(e.data == "running") {
    console.log("And we are off")
    timeOutID = setInterval(function() {
        postMessage("step");
      }, schedulingLookAhead);
  }
  else if(e.data.schedulingLookAhead) {
    schedulingLookAhead = e.data.schedulingLookAhead;

    console.log("SchedulingLookAhead set to :" + schedulingLookAhead);

    //if timeOutID then we are already running and this is changing timeout value
    if(timeOutID) {
      clearInterval(timeOutID);
      timeOutID = setInterval(function() {
          postMessage("step");
        }, schedulingLookAhead);
    }
  }
  else if(e.data == "stop") {
    console.log("stopping")
    clearInterval(timeOutID);
    timeOutID = null;
  }
}

postMessage("Sequencer Worker Initialised")
