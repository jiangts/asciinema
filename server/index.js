// CREDITS: https://www.terlici.com/2015/12/04/realtime-node-expressjs-with-sse.html
var express = require('express')
  , app = express()
  , sse = require('./sse')

var PORT = process.env.PORT || 3003;
var connections = [];

// app.use(express.static('public'))
app.use(express.static('player'))
app.use(sse)

// stuff the array into a dict with key event
app.get('/push-event', function(req, res) {
  console.log(req.query.event);
  connections.map(conn => conn.sseSend(req.query.event))

  res.sendStatus(200)
})

app.post('/push-event', function(req, res) {
  connections.map(conn => conn.sseSend(req.body.event))

  res.sendStatus(200)
})

app.get('/stream', function(req, res) {
  res.sseSetup()
  connections.push(res)
  res.sseSend({
    "version": 2,
    "width": 178,
    "height": 48,
    "command": "/bin/bash",
    "title": "",
    "env": {"SHELL": "/bin/bash", "TERM": "xterm-256color"},
    "stream_url": "http://localhost:" + PORT + "/stream",
    "idle_time_limit": null
  });
})

app.get('/live.json', function(req, res) {
  res.json({
    "version": 2,
    "width": 178,
    "height": 48,
    "command": "/bin/zsh",
    "title": "",
    "env": {"SHELL": "/bin/bash", "TERM": "xterm-256color"},
    "stream_url": "http://localhost:" + PORT + "/stream",
    "idle_time_limit": null
  });
});

app.listen(PORT, function() {
  console.log('Listening on port ' + PORT + '...');
})

