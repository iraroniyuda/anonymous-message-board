"use strict";

const crypto = require("crypto");
const mongoose = require("mongoose");

let isMongoConnected = false;
const memoryBoards = {};

const replySchema = new mongoose.Schema({
  _id: {
    type: mongoose.Schema.Types.ObjectId,
    default: () => new mongoose.Types.ObjectId()
  },
  text: String,
  delete_password: String,
  created_on: Date,
  reported: {
    type: Boolean,
    default: false
  }
});

const threadSchema = new mongoose.Schema({
  board: String,
  text: String,
  delete_password: String,
  created_on: Date,
  bumped_on: Date,
  reported: {
    type: Boolean,
    default: false
  },
  replies: {
    type: [replySchema],
    default: []
  }
});

const Thread = mongoose.models.Thread || mongoose.model("Thread", threadSchema);

async function connectMongo() {
  if (!process.env.DB) return false;

  if (isMongoConnected || mongoose.connection.readyState === 1) {
    return true;
  }

  await mongoose.connect(process.env.DB);
  isMongoConnected = true;
  return true;
}

function createId() {
  return crypto.randomBytes(12).toString("hex");
}

function getBoard(board) {
  if (!memoryBoards[board]) {
    memoryBoards[board] = [];
  }

  return memoryBoards[board];
}

function sanitizeReply(reply) {
  return {
    _id: String(reply._id),
    text: reply.text,
    created_on: reply.created_on
  };
}

function sanitizeThread(thread, replyLimit = null) {
  let replies = thread.replies || [];

  if (replyLimit !== null) {
    replies = replies.slice(-replyLimit);
  }

  return {
    _id: String(thread._id),
    text: thread.text,
    created_on: thread.created_on,
    bumped_on: thread.bumped_on,
    replies: replies.map(sanitizeReply),
    replycount: thread.replies.length
  };
}

module.exports = function (app) {
  app
    .route("/api/threads/:board")

    .post(async function (req, res) {
      const board = req.params.board;
      const { text, delete_password } = req.body;

      const now = new Date();

      try {
        const hasMongo = await connectMongo();

        if (!hasMongo) {
          const thread = {
            _id: createId(),
            board,
            text,
            delete_password,
            created_on: now,
            bumped_on: now,
            reported: false,
            replies: []
          };

          getBoard(board).push(thread);
          return res.json(thread);
        }

        const thread = await Thread.create({
          board,
          text,
          delete_password,
          created_on: now,
          bumped_on: now,
          reported: false,
          replies: []
        });

        return res.json(thread);
      } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "server error" });
      }
    })

    .get(async function (req, res) {
      const board = req.params.board;

      try {
        const hasMongo = await connectMongo();

        if (!hasMongo) {
          const threads = getBoard(board)
            .slice()
            .sort((a, b) => new Date(b.bumped_on) - new Date(a.bumped_on))
            .slice(0, 10)
            .map((thread) => sanitizeThread(thread, 3));

          return res.json(threads);
        }

        const threads = await Thread.find({ board })
          .sort({ bumped_on: -1 })
          .limit(10)
          .lean();

        return res.json(threads.map((thread) => sanitizeThread(thread, 3)));
      } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "server error" });
      }
    })

    .delete(async function (req, res) {
      const board = req.params.board;
      const { thread_id, delete_password } = req.body;

      try {
        const hasMongo = await connectMongo();

        if (!hasMongo) {
          const threads = getBoard(board);
          const index = threads.findIndex((thread) => thread._id === thread_id);

          if (index === -1 || threads[index].delete_password !== delete_password) {
            return res.type("text").send("incorrect password");
          }

          threads.splice(index, 1);
          return res.type("text").send("success");
        }

        const thread = await Thread.findOne({ _id: thread_id, board });

        if (!thread || thread.delete_password !== delete_password) {
          return res.type("text").send("incorrect password");
        }

        await Thread.deleteOne({ _id: thread_id, board });
        return res.type("text").send("success");
      } catch (err) {
        console.error(err);
        return res.type("text").send("incorrect password");
      }
    })

    .put(async function (req, res) {
      const board = req.params.board;
      const { thread_id } = req.body;

      try {
        const hasMongo = await connectMongo();

        if (!hasMongo) {
          const thread = getBoard(board).find((item) => item._id === thread_id);

          if (thread) {
            thread.reported = true;
          }

          return res.type("text").send("reported");
        }

        await Thread.findOneAndUpdate(
          { _id: thread_id, board },
          { reported: true }
        );

        return res.type("text").send("reported");
      } catch (err) {
        console.error(err);
        return res.type("text").send("reported");
      }
    });

  app
    .route("/api/replies/:board")

    .post(async function (req, res) {
      const board = req.params.board;
      const { thread_id, text, delete_password } = req.body;

      const now = new Date();

      try {
        const hasMongo = await connectMongo();

        if (!hasMongo) {
          const thread = getBoard(board).find((item) => item._id === thread_id);

          if (!thread) {
            return res.json({ error: "thread not found" });
          }

          const reply = {
            _id: createId(),
            text,
            delete_password,
            created_on: now,
            reported: false
          };

          thread.replies.push(reply);
          thread.bumped_on = now;

          return res.json(thread);
        }

        const reply = {
          _id: new mongoose.Types.ObjectId(),
          text,
          delete_password,
          created_on: now,
          reported: false
        };

        const thread = await Thread.findOneAndUpdate(
          { _id: thread_id, board },
          {
            $push: { replies: reply },
            bumped_on: now
          },
          { new: true }
        );

        return res.json(thread);
      } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "server error" });
      }
    })

    .get(async function (req, res) {
      const board = req.params.board;
      const { thread_id } = req.query;

      try {
        const hasMongo = await connectMongo();

        if (!hasMongo) {
          const thread = getBoard(board).find((item) => item._id === thread_id);

          if (!thread) {
            return res.json({});
          }

          return res.json(sanitizeThread(thread));
        }

        const thread = await Thread.findOne({ _id: thread_id, board }).lean();

        if (!thread) {
          return res.json({});
        }

        return res.json(sanitizeThread(thread));
      } catch (err) {
        console.error(err);
        return res.json({});
      }
    })

    .delete(async function (req, res) {
      const board = req.params.board;
      const { thread_id, reply_id, delete_password } = req.body;

      try {
        const hasMongo = await connectMongo();

        if (!hasMongo) {
          const thread = getBoard(board).find((item) => item._id === thread_id);

          if (!thread) {
            return res.type("text").send("incorrect password");
          }

          const reply = thread.replies.find((item) => item._id === reply_id);

          if (!reply || reply.delete_password !== delete_password) {
            return res.type("text").send("incorrect password");
          }

          reply.text = "[deleted]";
          return res.type("text").send("success");
        }

        const thread = await Thread.findOne({ _id: thread_id, board });

        if (!thread) {
          return res.type("text").send("incorrect password");
        }

        const reply = thread.replies.id(reply_id);

        if (!reply || reply.delete_password !== delete_password) {
          return res.type("text").send("incorrect password");
        }

        reply.text = "[deleted]";
        await thread.save();

        return res.type("text").send("success");
      } catch (err) {
        console.error(err);
        return res.type("text").send("incorrect password");
      }
    })

    .put(async function (req, res) {
      const board = req.params.board;
      const { thread_id, reply_id } = req.body;

      try {
        const hasMongo = await connectMongo();

        if (!hasMongo) {
          const thread = getBoard(board).find((item) => item._id === thread_id);

          if (thread) {
            const reply = thread.replies.find((item) => item._id === reply_id);

            if (reply) {
              reply.reported = true;
            }
          }

          return res.type("text").send("reported");
        }

        const thread = await Thread.findOne({ _id: thread_id, board });

        if (thread) {
          const reply = thread.replies.id(reply_id);

          if (reply) {
            reply.reported = true;
            await thread.save();
          }
        }

        return res.type("text").send("reported");
      } catch (err) {
        console.error(err);
        return res.type("text").send("reported");
      }
    });
};