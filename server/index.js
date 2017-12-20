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

var header;
var waitingConnections = []
app.get('/push-header', function(req, res) {
  header = req.query.header
  while(waitingConnections.length > 0) {
    waitingConnections.pop().sseSend(header);
  }
  console.log('HEADER', header)
  // our header is missing `title`, `command`

  res.sendStatus(200)
})

app.get('/stream', function(req, res) {
  res.sseSetup()
  connections.push(res)
  if (header) res.sseSend(header);
  else waitingConnections.push(res);
})

app.listen(PORT, function() {
  console.log('Listening on port ' + PORT + '...');
})

