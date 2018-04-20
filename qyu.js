
// Import events module for signal
var events = require('events');
// Import util for inheritance
var util = require('util');

const defaultRateLimit = 50;
const defaultStatsInterval = 300;
const defaultPriority = 5;


// Constructor
function Qyu(opts){
  this.jobsQueue = [];
  this.runningJobs = [];
  this.ids = 0;
  this.isQueueStarted = false;

  if (typeof opts.rateLimit === 'number' && opts.rateLimit !== null) {
    this.rateLimit = opts.rateLimit;
  } else {
    this.rateLimit = defaultRateLimit;
    console.log("Wrong format for rateLimit, setting to default (" + this.rateLimit + ")");
  }

  if (typeof opts.statsInterval === 'number' && opts.statsInterval !== null) {
    this.statsInterval = opts.statsInterval;
  } else {
    this.statsInterval = defaultStatsInterval
    console.log("Wrong format for statsInterval, setting to default (" + this.statsInterval + ")");
  }
}

// Add events methods to Qyu
util.inherits(Qyu, events.EventEmitter);

// Qyu control
Qyu.prototype.pause = async function () {
  console.log("Pausing queue...");
  return new Promise((resolve, reject) => {
    this._pauseSendStats();
    this.isQueueStarted = false;
    resolve();

   // await this._pauseAllJobs();
  });
};

Qyu.prototype.start = function () {
  console.log("Starting queue...");
  return new Promise((resolve,reject) => {
    if(this.isQueueStarted){
      console.log("Queue already started");
      reject("Queue already started");
    } else {
      this._startSendStats(this.statsInterval); 
      this.isQueueStarted = true;
      this._runLoop();
      resolve();
    }
  });
};

// Qyu stat update
Qyu.prototype._startSendStats = function(delay){
  this.statsInterval = setInterval(() => {
    this._updateStats();
  }, delay);
}

Qyu.prototype._updateStats = function(delay){
  this.emit('stats',({nbJobsPerSecond:4}));
}

Qyu.prototype._pauseSendStats = function(){
  clearInterval(this.statsInterval); 
}


// Qyu methods
Qyu.prototype._getId = function(){
  this.ids++;
  return this.ids;
}


Qyu.prototype.push = function (job, priority) {
  var prio;

  if(this.jobsQueue.length + 1 > this.rateLimit){
    console.log("Queue reached maximum capacity (" + this.rateLimit + ")");
    return -1;
  }

  if (typeof priority === 'number' && priority !== null) {
    prio = priority;  
  } else {
    prio = defaultPriority;
    console.log("Wrong format or no prio specified, setting to default (" + prio + ")");
  }


  // TODO PUSH AT THE RIGHT PLACE
  var id = this._getId();
  console.log("Pushing a new job with id " + id);
  this.jobsQueue.push({
                        id:id,
                        prio: prio,
                        func:job
                      });

};

Qyu.prototype.wait = async function(id) {
 // this.on()
};


Qyu.prototype.cancel = function (id) {
  console.log("Cancel job with id " + id);
};


Qyu.prototype._pauseAllJobs = function(){
 // return new Promise
};

// Qyu main loop
Qyu.prototype._runLoop = async function() {
  
  while(this.isQueueStarted){
    var job = this.jobsQueue.shift();
    if(!job && this.jobsQueue.length === 0){
      //console.log("No more job to process");
      //this.emit('drain');
    } else {
       try {
        result = await job.func();
        console.log("Job " + job.id + " has been executed");
        this.emit('done', ({id:job.id, result:result}));

        } catch (err) {
        console.log("Error during job " + job.id + " execution")
        this.emit('error', ({id:job.id, error:err}));
        }
        /*
new Promise((resolve,reject) => {
          try {
            result = job.func();
            console.log("Job " + job.id + " has been executed");
            this.emit('done', ({id:job.id, result:result}));
            resolve();
          } catch (err) {
            console.log("Error during job " + job.id + " execution")
            this.emit('error', ({id:job.id, error:err}));
            reject();
          }
      });*/
    }
  }

};


module.exports = Qyu;