

let QyuAlreadyStartedError = function(){
	return { code : "ERR_QYU_ALREADY_STARTED", message : "Qyu has already been started"};
}

let QyuMaxCapacityError = function(){
	return { code : "ERR_QYU_MAX_CAPACITY", message : "Queue reached maximum capacity"};
}

let QyuJobNotDefinedError = function(){
	return { code : "ERR_QYU_JOB_NOT_DEFINED", message : "Job is not properly defined"};
}

let QyuJobExecutionError = function(){
	return { code : "ERR_QYU_JOB_EXECUTION", message : "Error during job execution"};
}

/** export */
module.exports = {
	QyuAlreadyStartedError : QyuAlreadyStartedError,
  	QyuMaxCapacityError : QyuMaxCapacityError,
  	QyuJobNotDefinedError : QyuJobNotDefinedError,
  	QyuJobExecutionError : QyuJobExecutionError
}
