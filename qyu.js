/**
 * Qyu module.
 * @module qyu
 */

/** Import events module for signal */
var events = require('events');
/** Import util for inheritance */
var util = require('util');
/** Import custom errors */
var error = require('./error');

/** Default values */
const RATE_LIMIT_DEFAULT = 20;
const STATS_INTERVAL_DEFAULT = 300;
const PRIORITY_DEFAULT = 5;
const LOWEST_PRIORITY = 10;

/**
 * Qyu
 * @constructor
 * @param {object}  
 */
function Qyu(opts){
  // Associative array used to store jobs
  this.jobsQueue = [];
  // Counter for stats
  this.numberOfProcessedJobs = 0;
  // Ids list to ensure unique id
  this.ids = 0;

  this.isQueueStarted = false;
  this.startDate;

  if (typeof opts.rateLimit === 'number' && opts.rateLimit !== null) {
    this.rateLimit = opts.rateLimit;
  } else {
    this.rateLimit = RATE_LIMIT_DEFAULT;
    console.info("Wrong format for rateLimit, setting to default (" + this.rateLimit + ")");
  }

  if (typeof opts.statsInterval === 'number' && opts.statsInterval !== null) {
    this.statsIntervalDelay = opts.statsInterval;
  } else {
    this.statsIntervalDelay = STATS_INTERVAL_DEFAULT;
    console.info("Wrong format for statsInterval, setting to default (" + this.statsIntervalDelay + ")");
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
 * Get Qyu length - count keys into queue to compute length
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
 * Set job priority
 * @param {Number} job id
 * @param {Number} new prio to set
 */
Qyu.prototype.setJobPriority = function (id, prio) {
  if(this.jobsQueue[id] != undefined){
    this.jobsQueue[id].prio = prio;
  }
}

/**
 * Pause queue - no new job execution
 * @return {Promise} resolved when queue has paused (no jobs being processed)
 */
Qyu.prototype.pause = async function () {
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
  return new Promise((resolve,reject) => {
    if(this.isQueueStarted){
      reject(new error.QyuAlreadyStartedError());
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

  // Check if we do not go over the limit
  if(this.getQyuLength() + 1 > this.rateLimit){
    console.warn("Queue reached maximum capacity (" + this.rateLimit + ")");
    throw new error.QyuMaxCapacityError();
  }

  // Set correct priority
  if (typeof priority === 'number' && priority !== null) {
    if(priority > LOWEST_PRIORITY) {
      priority = LOWEST_PRIORITY; 
    }
    prio = priority;
  } else {
    prio = PRIORITY_DEFAULT;
  }

  let id = _allocateNewId(this);

  // Push the job with its data to an associative array which store all job to process
  // I could have used a usual array and sort it here. It would increase slightly performances.
  // However, using an associative array here allow some flexibility like priority update at any time
  // before job processing 
  this.jobsQueue[id] = {
                        id:id,
                        prio: prio,
                        func:job
                       };

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
    // Wait for the appropriate job to complete
    this.on('done', ({ id, result }) => {
        if(id === jobId){
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
 * Find highest prio
 * @param {object} jobsQueue associative array
 * @return {object} job with highest prio
 */
function _findByHighestPriority(jobsQueue) {
  // We want to find the highest prio (lowest value)
  // We start assuming that the highest prio is the lowest possible one.
  let highestPrioFound = LOWEST_PRIORITY;
  let job;

  for(var key in jobsQueue)
  {
    if(jobsQueue[key].prio < highestPrioFound){
      job = jobsQueue[key];
      highestPrioFound = job.prio;
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
    
    if(qyu.getQyuLength() === 0){
      // Queue is empty - notify with 'drain' event
      qyu.emit('drain');

    } else {
      // look for the highest priority job to process
      let job = _findByHighestPriority(qyu.jobsQueue);
      if(job != undefined){
        try {
          // Run the job
          qyu.jobsQueue[job.id].promise = job.func();
          qyu.jobsQueue[job.id].promise.then(function(result) {
            // Increase jobs processed counter
            qyu.numberOfProcessedJobs++;
            // Notify with 'done' event
            qyu.emit('done', ({id:job.id, result:result}));
              
            // Clean the job queue
            delete qyu.jobsQueue[job.id];
              
            // Process next !
            _processNext(qyu);

          }).catch(function(err){
            // An error occured - notify with 'error' event
            qyu.emit('error', ({id:job.id, error: new error.QyuJobExecutionError() }));
            
            // Clean the job queue
            delete qyu.jobsQueue[job.id];

            // Process next
            _processNext(qyu);
          });
        } catch(err){
          // An error occured - notify with 'error' event
          qyu.emit('error', ({id:job.id, error: new error.QyuJobExecutionError() }));
          // Clean the job queue
          delete qyu.jobsQueue[job.id];
          
          _processNext(qyu);
        }
      } else {
        // Throw an error as something weird happened into the queue
        throw new error.QyuJobNotDefinedError();
      }
    }
  }
};

/** export */
module.exports = Qyu;