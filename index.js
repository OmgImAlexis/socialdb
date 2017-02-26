/*
  Social graph for user friends and relationships.
  API:
    Actions:
    * follow(fromId, toId)
    * unfollow(fromId, toId)

    Data:
    * pending(userId)
    * requested(userId)
    * accepted(userId)
    * friends(userId) (alias of accepted)
 */
class SocialGraph {
  constructor(redis = null) {
    this.redis = redis;
  }

  /**
   * Creates a relationship between fromId and toId
   * i.e:
   *   user 1 wants to follow user 11:
   *     follow(1, 11)
   *     user:1:requested 11
   *     user:11:pending 1
   *   user 11 follows user 1 back:
   *     follow(11, 1)
   *     user:1:requested n/a
   *     user:11:pending n/a
   *     user:1:accepted 11
   *     user:11:accepted 1
   */
  follow(fromId, toId, callback) {
    // check if this is an initial or reciprocal request
    this.redis.sismember(`user:${fromId}:pending`, toId, (err, res) => {
      if (res === 0) {
        // we have an initial request
        this.redis.multi()
          .sadd(`user:${fromId}:requested`, toId)
          .sadd(`user:${toId}:pending`, fromId)
          .exec();
        return callback(true);
      }
      // we have a reciprocal request
      this.redis.multi()
        .srem(`user:${fromId}:pending`, toId)
        .srem(`user:${toId}:requested`, fromId)
        .sadd(`user:${toId}:accepted`, fromId)
        .sadd(`user:${fromId}:accepted`, toId)
        .exec();
      return callback(true);
    });
  }

  requested(userId, callback) {
    this.redis.smembers(`user:${userId}:requested`, (err, res) => (callback(res)));
  }

  pending(userId, callback) {
    this.redis.smembers(`user:${userId}:pending`, (err, res) => (callback(res)));
  }

  accepted(userId, callback) {
    this.redis.smembers(`user:${userId}:accepted`, (err, res) => (callback(res)));
  }

}

module.exports = SocialGraph;
