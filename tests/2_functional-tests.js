const chaiHttp = require("chai-http");
const chai = require("chai");
const assert = chai.assert;
const server = require("../server");

chai.use(chaiHttp);

suite("Functional Tests", function () {
  const board = "testboard";
  let threadId;
  let secondThreadId;
  let replyId;

  test("Creating a new thread: POST request to /api/threads/{board}", function (done) {
    chai
      .request(server)
      .post(`/api/threads/${board}`)
      .send({
        text: "First test thread",
        delete_password: "threadpass"
      })
      .end(function (err, res) {
        if (err) return done(err);

        assert.equal(res.status, 200);
        assert.property(res.body, "_id");
        assert.equal(res.body.text, "First test thread");
        assert.equal(res.body.delete_password, "threadpass");
        assert.property(res.body, "created_on");
        assert.property(res.body, "bumped_on");
        assert.equal(res.body.reported, false);
        assert.isArray(res.body.replies);

        threadId = res.body._id;
        done();
      });
  });

  test("Viewing the 10 most recent threads with 3 replies each: GET request to /api/threads/{board}", function (done) {
    chai
      .request(server)
      .post(`/api/threads/${board}`)
      .send({
        text: "Second test thread",
        delete_password: "secondpass"
      })
      .end(function (err, postRes) {
        if (err) return done(err);

        secondThreadId = postRes.body._id;

        chai
          .request(server)
          .get(`/api/threads/${board}`)
          .end(function (err, res) {
            if (err) return done(err);

            assert.equal(res.status, 200);
            assert.isArray(res.body);
            assert.isAtMost(res.body.length, 10);
            assert.property(res.body[0], "_id");
            assert.property(res.body[0], "text");
            assert.property(res.body[0], "created_on");
            assert.property(res.body[0], "bumped_on");
            assert.property(res.body[0], "replies");
            assert.property(res.body[0], "replycount");
            assert.notProperty(res.body[0], "delete_password");
            assert.notProperty(res.body[0], "reported");

            done();
          });
      });
  });

  test("Deleting a thread with the incorrect password: DELETE request to /api/threads/{board}", function (done) {
    chai
      .request(server)
      .delete(`/api/threads/${board}`)
      .send({
        thread_id: threadId,
        delete_password: "wrongpass"
      })
      .end(function (err, res) {
        if (err) return done(err);

        assert.equal(res.text, "incorrect password");
        done();
      });
  });

  test("Deleting a thread with the correct password: DELETE request to /api/threads/{board}", function (done) {
    chai
      .request(server)
      .delete(`/api/threads/${board}`)
      .send({
        thread_id: secondThreadId,
        delete_password: "secondpass"
      })
      .end(function (err, res) {
        if (err) return done(err);

        assert.equal(res.text, "success");
        done();
      });
  });

  test("Reporting a thread: PUT request to /api/threads/{board}", function (done) {
    chai
      .request(server)
      .put(`/api/threads/${board}`)
      .send({
        thread_id: threadId
      })
      .end(function (err, res) {
        if (err) return done(err);

        assert.equal(res.text, "reported");
        done();
      });
  });

  test("Creating a new reply: POST request to /api/replies/{board}", function (done) {
    chai
      .request(server)
      .post(`/api/replies/${board}`)
      .send({
        thread_id: threadId,
        text: "First reply",
        delete_password: "replypass"
      })
      .end(function (err, res) {
        if (err) return done(err);

        assert.equal(res.status, 200);
        assert.property(res.body, "_id");
        assert.isArray(res.body.replies);
        assert.isAtLeast(res.body.replies.length, 1);

        replyId = res.body.replies[0]._id;
        done();
      });
  });

  test("Viewing a single thread with all replies: GET request to /api/replies/{board}", function (done) {
    chai
      .request(server)
      .get(`/api/replies/${board}`)
      .query({
        thread_id: threadId
      })
      .end(function (err, res) {
        if (err) return done(err);

        assert.equal(res.status, 200);
        assert.equal(res.body._id, threadId);
        assert.isArray(res.body.replies);
        assert.isAtLeast(res.body.replies.length, 1);
        assert.notProperty(res.body, "delete_password");
        assert.notProperty(res.body, "reported");
        assert.notProperty(res.body.replies[0], "delete_password");
        assert.notProperty(res.body.replies[0], "reported");

        done();
      });
  });

  test("Deleting a reply with the incorrect password: DELETE request to /api/replies/{board}", function (done) {
    chai
      .request(server)
      .delete(`/api/replies/${board}`)
      .send({
        thread_id: threadId,
        reply_id: replyId,
        delete_password: "wrongpass"
      })
      .end(function (err, res) {
        if (err) return done(err);

        assert.equal(res.text, "incorrect password");
        done();
      });
  });

  test("Deleting a reply with the correct password: DELETE request to /api/replies/{board}", function (done) {
    chai
      .request(server)
      .delete(`/api/replies/${board}`)
      .send({
        thread_id: threadId,
        reply_id: replyId,
        delete_password: "replypass"
      })
      .end(function (err, res) {
        if (err) return done(err);

        assert.equal(res.text, "success");
        done();
      });
  });

  test("Reporting a reply: PUT request to /api/replies/{board}", function (done) {
    chai
      .request(server)
      .post(`/api/replies/${board}`)
      .send({
        thread_id: threadId,
        text: "Second reply",
        delete_password: "replypass2"
      })
      .end(function (err, postRes) {
        if (err) return done(err);

        const newReplyId = postRes.body.replies[postRes.body.replies.length - 1]._id;

        chai
          .request(server)
          .put(`/api/replies/${board}`)
          .send({
            thread_id: threadId,
            reply_id: newReplyId
          })
          .end(function (err, res) {
            if (err) return done(err);

            assert.equal(res.text, "reported");
            done();
          });
      });
  });
});