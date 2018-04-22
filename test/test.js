beforeEach(function() {

});

var assert = require('assert');
var qyu = require('../qyu');

describe('new qyu()', function () {
	it('should initiliase Qyu module', function () {
		const q = new qyu({
			  rateLimit: 10,
			  statsInterval: 2000 
			});

		assert.equal(q.getRateLimit(), 10);
		assert.equal(q.getStatsInterval(), 2000);
  	})
});

describe('Push()', function () {
	it('should push a job, set priority and returns id', function () {
		const q = new qyu({
			  rateLimit: 10,
			  statsInterval: 2000 
			});
		
		var id1 = q.push(async function () {}, 6);
		// Check id
		assert.equal(id1, 1);
		//Check prio
		assert.equal(q.getJobPriority(1), 6);
		// Check default prio
		var id2 = q.push(async function () {});
		assert.equal(id2, 2);
		assert.equal(q.getJobPriority(2), 5);
		assert.equal(q.getQyuLength(), 2);
  	})
});

describe('PushLimit()', function () {
	it('should refuse to push job after the limit', async function () {
		const q = new qyu({
			  rateLimit: 10,
			  statsInterval: 2000 
			});

		var count = 0;
		while(1){
			try {
				q.push(async function () {}, 6);
				count++;
			}catch (error){
				assert.equal(error.code, 500);
				break;
			}
		}
		assert.equal(count, 10);
  	})
});

describe('Start()', function () {
	it('should resolve a promise when qyu has started', async function () {
		const q = new qyu({
			  rateLimit: 10,
			  statsInterval: 2000 
			});
		const result = await q.start();
  		assert.equal(result,"Qyu started"); 
  	})
});

describe('Pause()', function () {
	it('should resolve a promise when qyu has paused', async function () {
		const q = new qyu({
			  rateLimit: 10,
			  statsInterval: 2000 
			});

		const result = await q.pause();
  		assert.equal(result,"Qyu paused"); 
  	})
});

describe('ReStart()', function () {
	it('should resolve a promise when qyu has started after a pause', async function () {
		const q = new qyu({
			  rateLimit: 10,
			  statsInterval: 2000 
			});
		const resultStart = await q.start();
  		assert.equal(resultStart,"Qyu started");

		const resultPause = await q.pause();
  		assert.equal(resultPause,"Qyu paused"); 

  		const resultReStart = await q.start();
  		assert.equal(resultReStart,"Qyu started");
  	})
});

describe('StartTwice()', function () {
	it('should reject a promise because qyu is trying to be started twice', async function () {
		const q = new qyu({
			  rateLimit: 10,
			  statsInterval: 2000 
			});
		const result = await q.start();
  		assert.equal(result,"Qyu started");

  		try {
  			const resultReStart = await q.start();
  		} catch (error) {
    		assert.equal(error,"Queue already started");
		}
  	})
});