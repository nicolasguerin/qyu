/**
 * Qyu module.
 * @module qyu
 */

/** Import events module for signal */
var events = require('events');
/** Import util for inheritance */
var util = require('util');

//var error = require('./error');

/** Default values */
const RATE_LIMIT_DEFAULT = 20;
const STATS_INTERVAL_DEFAULT = 300;
const PRIORITY_DEFAULT = 5;
const MAX_PRIORITY = 10;

/**
 * Qyu
 * @constructor
 * @param {object}  
 */
function Qyu(opts){
  this.jobsQueue = [];
  this.runningJobs = {};
  this.numberOfProcessedJobs = 0;
  this.ids = 0;
  this.isQueueStarted = false;
  this.startDate;

  if (typeof opts.rateLimit === 'number' && opts.rateLimit !== null) {
    this.rateLimit = opts.rateLimit;
  } else {
    this.rateLimit = RATE_LIMIT_DEFAULT;
    console.log("Wrong format for rateLimit, setting to default (" + this.rateLimit + ")");
  }

  if (typeof opts.statsInterval === 'number' && opts.statsInterval !== null) {
    this.statsIntervalDelay = opts.statsInterval;
  } else {
    this.statsIntervalDelay = STATS_INTERVAL_DEFAULT;
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
  return Object.keys(this.jobsQueue).length;
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
   return this.jobsQueue[id].prio;
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
  let prio;

  if(this.getQyuLength() + 1 > this.rateLimit){
    console.log("Queue reached maximum capacity (" + this.rateLimit + ")");
    throw {code: 500, msg:"Queue reached maximum capacity"};
  }

  if (typeof priority === 'number' && priority !== null) {
    if(priority > MAX_PRIORITY) {
      priority = MAX_PRIORITY; 
    }
    prio = priority;

  } else {
    prio = PRIORITY_DEFAULT;
    console.log("Wrong format or no prio specified, setting to default (" + prio + ")");
  }

  let id = _allocateNewId(this);
  //console.log("Pushing a new job with id " + id + " with priority "+ prio);

  this.jobsQueue[id] = {
                        id:id,
                        prio: prio,
                        func:job
                       };

  //this.jobsQueue.sort(_prioCompare);

  _processNext(this);

  return id;
};

/**
 * Wait for a job to complete
 * @param {Number} job id to wait for
 * @return {promise} resolves when the job is complete with the job result
 */
Qyu.prototype.wait = async function(jobId) {
  return new Promise((resolve,reject) => {
    this.on('done', ({ id, result }) => {
        if(id ===jobId){
          resolve(result);
        }
      });
  });
};


/**
 * Remove a job from the queue - job shouldn't have been executed
 * @param {Number} job id to remove
 */
Qyu.prototype.cancel = function (id) {
  delete this.jobsQueue[id];
};


/** Internal functions */

/**
 * Start stats update
 * @param {object} qyu instance
 */
function _startSendStats(qyu){
  qyu.startDate = new Date();
  qyu.statInterval = setInterval(() => {
    _updateStats(qyu);
  }, qyu.statsIntervalDelay);
}

/**
 * Send stats update
 * @param {object} qyu instance
 */
function _updateStats(qyu){
  let duration = new Date() - qyu.startDate;
  let nbJobsPerSecond = qyu.numberOfProcessedJobs / (duration / 1000);
  qyu.emit('stats',({nbJobsPerSecond: nbJobsPerSecond }));
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
function _findByHighestPriority(jobsQueue) {
  let lowestPrio = 10;
  let job;

  for(var key in jobsQueue)
  {
    if(jobsQueue[key].prio < lowestPrio){
      job = jobsQueue[key];
      lowestPrio = job.prio;
    }
  }
  return job;
}


/**
 * Process next job from the queue
 * @param {object} qyu instance
 */
async function _processNext(qyu) {
  
  if(qyu.isQueueStarted){
    

    if(qyu.jobsQueue.length === 0){
    
      console.log("No more job to process");
      qyu.emit('drain');
    
    } else {
      let job = _findByHighestPriority(qyu.jobsQueue);
      if(job != undefined){

        qyu.jobsQueue[job.id].promise = job.func();

        qyu.jobsQueue[job.id].promise.then(function(result) {
          qyu.numberOfProcessedJobs++;
          qyu.emit('done', ({id:job.id, result:result}));
          delete qyu.jobsQueue[job.id];
          _processNext(qyu);
        }).catch(function(error){
          qyu.emit('error', ({id:job.id, error:error}));
          _processNext(qyu);
        } );
      } else {
        //throw new Error();
      }
      
    }
  }
};

/** export */
module.exports = Qyu;