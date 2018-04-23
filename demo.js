
const qyu = require('./qyu');

const q = new qyu({
  rateLimit: 10, // maximum number of jobs being processed at the same time
  statsInterval: 2000 // When stat event is sent, in ms
});


/** Events handling */

q.on('done', ({ id, result }) => {
  if(result != undefined)
    console.log(`Job done ${id} with result ${result.Hello}`); // `id` is an internal identifier generated by `qyu`
  else
    console.log(`Cannot display result of job ${id}`);
});

q.on('error', ({ id, error }) => {
  console.log(`Job ${id} threw an error: ${error.message}`);
});

q.on('drain', () => {
  console.log('No more jobs to do');
});

q.on('stats', ({ nbJobsPerSecond }) => {
  console.log(`${nbJobsPerSecond} jobs/s processed`)
});


/** Play with the queue and several jobs */

(async () => {
  const id1 = q.push(
    job, // function to execute
    3   // optional priority, from 1 to 10, 1 being the highest priority - default: 5
  ); // returns the internal id

  const id2 = q.push(job);
  const id3 = q.push(job, 1); 
  const id4 = q.push(jobError, 4); // -> will trigger 'error' event

  // Expected order result is id3 - id1 - id4 - id2

  await q.pause(); // returns a promise resolved when `q` has paused (no jobs being processed)
  await q.start(); // returns a promise resolved when `q` has started (first time) or unpaused

  try {
    const res = await q.wait(id1); // resolves when the job is complete with the job result
    console.log(`q.wait resolve with result ${res.Hello}`);
  }catch (error){
    console.log(error.message);
  } 
})();


/** Some sample jobs */

async function job() {
  await wait(3000);
  return {Hello: 'world!'} // That's the job `result`
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  });
}

function jobError() { throw new Error(); }
