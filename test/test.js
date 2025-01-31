const assert = require('assert');
const redis = require('redis');

const client = redis.createClient();

client.on('error', (err) => {
  console.log(err);
});

const SocialDB = require('../dist/index.js').default;

describe('Testing SocialDB', () => {
  const sd = new SocialDB(client);

  before(() => {
    client.flushdb();
  });

  // workaround for `nyc mocha` hanging
  after(() => {
    process.exit(0);
  });

  describe('.follow()', () => {
    describe('initial request', () => {
      it('should add users to `requested` and `pending`', (done) => {
        sd.follow(1, 11).then(() => {
          client.zcard(`socialdb:user:${1}:requested`, (err, count) => {
            assert.equal(count, 1);
            client.zcard(`socialdb:user:${11}:pending`, (err2, count2) => {
              assert.equal(count2, 1);
              client.zcard(`socialdb:user:${11}:accepted`, (err3, count3) => {
                assert.equal(count3, 0);
                done();
              });
            });
          });
        });
      });
    });

    describe('reciprocal request', () => {
      it('should remove users from `requested` and `pending`', (done) => {
        sd.follow(11, 1).then(() => {
          client.zcard(`socialdb:user:${1}:requested`, (err, count) => {
            assert.equal(count, 0);
            client.zcard(`socialdb:user:${11}:pending`, (err2, count2) => {
              assert.equal(count2, 0);
              done();
            });
          });
        });
      });

      it('should add users to `accepted`', (done) => {
        client.zcard(`socialdb:user:${1}:accepted`, (err, count) => {
          assert.equal(count, 1);
          client.zcard(`socialdb:user:${11}:accepted`, (err2, count2) => {
            assert.equal(count2, 1);
            done();
          });
        });
      });
    });
  });

  describe('.unfollow()', () => {
    it('should mututally unfollow two users', (done) => {
      sd.unfollow(1, 11).then(() => {
        client.zcard(`socialdb:user:${1}:accepted`, (err, count) => {
          assert.equal(count, 0);
          client.zcard(`socialdb:user:${11}.accepted`, (err2, count2) => {
            assert.equal(count2, 0);
            done();
          });
        });
      });
    });
  });

  describe('.invite()', () => {
    it('should invite a user', (done) => {
      sd.invite(1234, 'some_id').then(() => {
        client.zcard('socialdb:user:some_id:invited', (err, count) => {
          assert.equal(count, 1);
          done();
        });
      });
    });
  });

  describe('.block()', () => {
    it('should block a user', (done) => {
      sd.block('from_id', 'some_id').then(() => {
        client.zcard('socialdb:user:from_id:blocked', (err, count) => {
          assert.equal(count, 1);
          done();
        });
      });
    });
  });

  describe('.deleteInvites()', () => {
    it('should delete all invites', (done) => {
      sd.deleteInvites('some_id').then(() => {
        client.zcard('socialdb:user:some_id:invited', (err, count) => {
          assert.equal(count, 0);
          done();
        });
      });
    });
  });

  describe('.invited()', () => {
    it('should get a list of 0 invited users', (done) => {
      sd.invited('+14153337777').then((users) => {
        assert.equal(users.length, 0);
        done();
      });
    });

    it('should get a list of 1 invited users', (done) => {
      sd.invite(11, '+14153337777').then(() => {
        sd.invited('+14153337777').then((users) => {
          assert.equal(users.length, 1);
          done();
        });
      });
    });

    it('should get a list of 2 invited users', (done) => {
      sd.invite(111, '+14153337777').then(() => {
        sd.invited('+14153337777').then((users) => {
          assert.equal(users.length, 2);
          done();
        });
      });
    });
  });

  describe('.requested()', () => {
    it('should get a list of requested followers', (done) => {
      sd.requested(1).then((users) => {
        assert.equal(users.length, 0);
        done();
      });
    });

    it('should get a list of requested followers', (done) => {
      sd.follow(1, 11).then(() => {
        sd.requested(1).then((users) => {
          assert.equal(users.length, 1);
          done();
        });
      });
    });
  });

  describe('.pending()', () => {
    it('should get a list of pending followers', (done) => {
      sd.pending(1).then((users) => {
        assert.equal(users.length, 0);
        done();
      });
    });

    it('should get a list of pending followers', (done) => {
      sd.follow(1, 11).then(() => {
        sd.pending(11).then((users) => {
          assert.equal(users.length, 1);
          done();
        });
      });
    });
  });

  describe('.accepted()', () => {
    client.flushdb(() => {
      it('should get a list of accepted followers', (done) => {
        sd.accepted(1).then((users) => {
          assert.equal(users.length, 0);
          done();
        });
      });
    });

    it('should get a list of accepted followers', (done) => {
      sd.follow(1, 11).then(() => {
        sd.follow(11, 1).then(() => {
          sd.accepted(11).then((users) => {
            assert.equal(users.length, 1);
            sd.accepted(1).then((users2) => {
              assert.equal(users2.length, 1);
              done();
            });
          });
        });
      });
    });
  });

  describe('.friends()', () => {
    it('should get a list of accepted followers', (done) => {
      client.flushdb(() => {
        sd.friends(1).then((users) => {
          assert.equal(users.length, 0);
          done();
        });
      });
    });

    it('should get a list of accepted followers using Promise chaining', (done) => {
      sd.follow(1, 11)
        .then(() => sd.follow(11, 1))
        .then(() => sd.unfollow(11, 1))
        .then(() => sd.friends(1))
        .then((users) => {
          assert.equal(users.length, 0);
          done();
        });
    });
  });

  describe('README code examples', () => {
    it('user 2 should request to follow user 3', (done) => {
      // user 2 requests to follow user 3
      sd.follow(2, 3)
        // get a list of user 2's requested friends
        .then(() => sd.requested(2))
        .then((users) => {
          assert.equal(users[0], 3);
        })
        // get a list of user 3's friends with pending requests
        .then(() => sd.pending(3))
        .then((users) => {
          assert.equal(users[0], 2);
          done();
        });
    });

    it('user 3 should request to follow user 2 back', (done) => {
      // user 3 requests to follow user 2 back
      sd.follow(3, 2)
        // get a list of user 2's friends
        .then(() => sd.friends(2))
        .then((users) => {
          assert.equal(users[0], 3);
        })
        // get a list of user 3's friends
        .then(() => sd.friends(3))
        .then((users) => {
          assert.equal(users[0], 2);
          done();
        });
    });

    it('user 2 should unfollow user 3', (done) => {
      // user 2 requests to unfollow user 3
      sd.unfollow(2, 3)
        // get a list of user 2's friends
        .then(() => sd.friends(2))
        .then((users) => {
          assert.equal(users[0], null);
        })
        // get a list of user 3's friends
        .then(() => sd.friends(3))
        .then((users) => {
          assert.equal(users[0], null);
          done();
        });
    });
  });
});
