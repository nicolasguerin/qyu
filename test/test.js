beforeEach(function() {
  console.log('before every test in every file');
});

var qyu = require('../qyu');

describe('Array', function() {
  describe('#indexOf()', function() {
    it('should initiliase Qyu module', function() {
      
      [,3].indexOf(5).should.equal(-1);
    });
  });
});