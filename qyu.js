/**
 * Qyu module.
 * @module qyu
 */

/** Import events module for signal */
var events = require('events');
/** Import util for inheritance */
var util = require('util');

/** Default values */
const defaultRateLimit = 20;
const defaultStatsInterval = 300;
const defaultPriority = 5;
const maxPriority = 10;

/**
 * Qyu
 * @constructor
 * @param {object}  
 */
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
    this.statsIntervalDelay = opts.statsInterval;
  } else {
    this.statsIntervalDelay = defaultStatsInterval
    console.log("Wrong format for statsInterval, setting to default (" + this.statsIntervalDelay + ")");
  }
}

/** Add events methods to Qyu */
util.inherits(Qyu, events.EventEmitter);


/** Exported functions for Qyu control */

/**
 * Get rate limit
 * @return {Number} max number of jobs processed at the same time
 */
Qyu.prototype.getRateLimit = function () {
  return this.rateLimit;
}

/**
 * Get stats interval
 * @return {Number} interval between stats update
 */
Qyu.prototype.getStatsInterval = function () {
  return this.statsIntervalDelay;
}

/**
 * Get Qyu length
 * @return {Number} queue length
 */
Qyu.prototype.getQyuLength = function () {
  return this.jobsQueue.length;
}

/**
 * Is Qyu started ?
 * @return {Boolean} true if queue has been started, false otherwise
 */
Qyu.prototype.isQyuStarted = function () {
  return this.isQueueStarted;
}

/**
 * Get job priority
 * @param {Number} job id  
 * @return {Number} priority of job with this id
 */
Qyu.prototype.getJobPriority = function (id) {
  return this.jobsQueue.find(function(job) {
    return job.id === id;
  }).prio;
}


/**
 * Pause queue - no new job execution
 * @return {Promise} resolved when queue has paused (no jobs being processed)
 */
Qyu.prototype.pause = async function () {
  console.log("Pausing queue...");
  return new Promise((resolve, reject) => {
    _pauseSendStats(this);
    this.isQueueStarted = false;
    resolve("Qyu paused");
  });
};

/**
 * Start queue
 * @return {Promise} resolved when queue has started (first time) or unpaused
 */
Qyu.prototype.start = function () {
  console.log("Starting queue...");
  return new Promise((resolve,reject) => {
    if(this.isQueueStarted){
      console.log("Queue already started");
      reject("Queue already started");
    } else {
      _startSendStats(this); 
      this.isQueueStarted = true;
      _processNext(this);
      resolve("Qyu started");
    }
  });
};


/**
 * Push a new job to the queue
 * @param {object} a function to execute
 * @param {Number} priority of the job - 1 is highest priority - 10 is max - 5 default when not specified 
 * @return {Number} id of the job queued
 */
Qyu.prototype.push = function (job, priority) {
  var prio;

  if(this.jobsQueue.length + 1 > this.rateLimit){
    console.log("Queue reached maximum capacity (" + this.rateLimit + ")");
    throw {code: 500, msg:"Queue reached maximum capacity"};
  }

  if (typeof priority === 'number' && priority !== null) {
    if(priority < maxPriority) {
      prio = priority; 
    } else {
      prio = maxPriority;
    }
  } else {
    prio = defaultPriority;
    console.log("Wrong format or no prio specified, setting to default (" + prio + ")");
  }

  var id = _allocateNewId(this);
  //console.log("Pushing a new job with id " + id + " with priority "+ prio);

  this.jobsQueue.push({
                        id:id,
                        prio: prio,
                        func:job
                      });

  this.jobsQueue.sort(_prioCompare);

  _processNext(this);

  return id;
};

/*Qyu.prototype.wait = async function(id) {
 //return await ;
};*/


/**
 * Remove a job from the queue - job shouldn't have been executed
 * @param {Number} job id to remove
 */
Qyu.prototype.cancel = function (id) {
  var job = this.jobsQueue.find(function(job) { return job.id === id; });
  var jobIndex = this.jobsQueue.indexOf(job);
  if (jobIndex > -1) {
    this.jobsQueue.splice(jobIndex, 1);
  }
};


/** Internal functions */

/**
 * Start stats update
 * @param {object} qyu instance
 */
function _startSendStats(qyu){
  qyu.statInterval = setInterval(() => {
    _updateStats(qyu);
  }, qyu.statsIntervalDelay);
}

/**
 * Send stats update
 * @param {object} qyu instance
 */
function _updateStats(qyu){
  qyu.emit('stats',({nbJobsPerSecond:4}));
}

/**
 * Pause stats update
 * @param {object} qyu instance
 */
function _pauseSendStats(qyu){
  clearInterval(qyu.statInterval); 
}

/**
 * Return a new unused ID
 * @param {object} qyu instance
 * @return {Number} a new id
 */
function _allocateNewId(qyu){
  qyu.ids++;
  return qyu.ids;
}

/**
 * Compare job prio - used for sorting
 * @param {Number} element A to compare
 * @param {Number} element B to compare
 */
function _prioCompare(a,b) {
  if (a.prio < b.prio)
    return -1;
  if (a.prio > b.prio)
    return 1;
  return 0;
}

/**
 * Process next job from the queue
 * @param {object} qyu instance
 */
async function _processNext(qyu) {
  
  if(qyu.isQueueStarted){
    var job = qyu.jobsQueue.shift();

    if(!job && qyu.jobsQueue.length === 0){
    
      console.log("No more job to process");
      qyu.emit('drain');
    
    } else {
    
       try {
        result = await job.func();
        console.log("Job " + job.id + " has been executed");
        qyu.emit('done', ({id:job.id, result:result}));
      } catch (err) {
        console.log("Error during job " + job.id + " execution");
        qyu.emit('error', ({id:job.id, error:err}));
      }

      _processNext(qyu);
    
    }
  }
};

/** export */
module.exports = Qyu;