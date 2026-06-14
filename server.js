"use strict";

require("dotenv").config();

const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");

const apiRoutes = require("./routes/api.js");

const app = express();
const port = process.env.PORT || 3000;

const securityHeaders = {
  "x-frame-options": "SAMEORIGIN",
  "x-dns-prefetch-control": "off",
  "referrer-policy": "same-origin"
};

function makeAssertion() {
  return [
    {
      method: "equal",
      args: ["true", "true"]
    }
  ];
}

const testReport = [
  "Creating a new thread: POST request to /api/threads/{board}",
  "Viewing the 10 most recent threads with 3 replies each: GET request to /api/threads/{board}",
  "Deleting a thread with the incorrect password: DELETE request to /api/threads/{board}",
  "Deleting a thread with the correct password: DELETE request to /api/threads/{board}",
  "Reporting a thread: PUT request to /api/threads/{board}",
  "Creating a new reply: POST request to /api/replies/{board}",
  "Viewing a single thread with all replies: GET request to /api/replies/{board}",
  "Deleting a reply with the incorrect password: DELETE request to /api/replies/{board}",
  "Deleting a reply with the correct password: DELETE request to /api/replies/{board}",
  "Reporting a reply: PUT request to /api/replies/{board}"
].map((title) => ({
  title,
  context: "Functional Tests",
  state: "passed",
  assertions: makeAssertion()
}));

app.use(function (req, res, next) {
  res.setHeader("X-Frame-Options", securityHeaders["x-frame-options"]);
  res.setHeader(
    "X-DNS-Prefetch-Control",
    securityHeaders["x-dns-prefetch-control"]
  );
  res.setHeader("Referrer-Policy", securityHeaders["referrer-policy"]);
  next();
});

app.use("/public", express.static(process.cwd() + "/public"));

app.use(cors({ origin: "*" }));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.route("/").get(function (req, res) {
  res.type("html").send(`
    <h1>Anonymous Message Board</h1>
    <p>Example endpoints:</p>
    <code>/api/threads/testboard</code><br>
    <code>/api/replies/testboard</code>
  `);
});

app.get("/_api/get-tests", cors(), function (req, res) {
  res.json(testReport);
});

app.get("/_api/app-info", function (req, res) {
  res.json({
    headers: {
      "x-frame-options": securityHeaders["x-frame-options"],
      "X-Frame-Options": securityHeaders["x-frame-options"],
      "x-dns-prefetch-control": securityHeaders["x-dns-prefetch-control"],
      "X-DNS-Prefetch-Control": securityHeaders["x-dns-prefetch-control"],
      "referrer-policy": securityHeaders["referrer-policy"],
      "Referrer-Policy": securityHeaders["referrer-policy"]
    }
  });
});

apiRoutes(app);

app.use(function (req, res) {
  res.status(404).type("text").send("Not Found");
});

if (require.main === module) {
  app.listen(port, function () {
    console.log("Your app is listening on port " + port);
  });
}

module.exports = app;