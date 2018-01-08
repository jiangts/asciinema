// CREDITS: https://www.terlici.com/2015/12/04/realtime-node-expressjs-with-sse.html
var express = require('express')
  , app = express()
  , sse = require('./sse')
  , shortid = require('shortid')

var PORT = process.env.PORT || 3003;

// app.use(express.static('public'))
app.use(express.static('player'))
app.use(sse)

var sessions = {}

var makeSession = function(key) {
  return {
    waterline: 0,
    buffer: {},
    header: null,
    waitingConnections: [],
    connections: []
  }
}

// stuff the array into a dict with key event
app.get('/push-event', function(req, res) {
  // console.log(req.query);
  var sessionKey = req.query.session
  if (sessionKey) {
    var session = sessions[sessionKey]

    if(req.query.seqno == 1) session.waterline = 0;
    session.buffer[req.query.seqno] = req.query.event

    while(session.buffer[session.waterline+1]) {
      var ev = session.buffer[session.waterline+1]
      session.connections.map(conn => conn.sseSend(ev))
      delete session.buffer[session.waterline+1]
      session.waterline += 1
    }

    res.sendStatus(200)
  }
  else {
    res.status(400).end('missing session query parameter')
  }
})

app.get('/push-header', function(req, res) {
  var sessionKey = req.query.session
  if (sessionKey) {
    sessions[sessionKey] = makeSession(sessionKey)
    var session = sessions[sessionKey]

    session.header = req.query.header
    while(session.waitingConnections.length > 0) {
      waitingConnections.pop().sseSend(session.header);
    }
    console.log('HEADER', session.header)
    // our header is missing `title`, `command`

    res.sendStatus(200)
  }
  else {
    res.status(400).end('missing session query parameter')
  }
})

app.get('/request-session', function(req, res) {
  var id = shortid.generate()
  res.json({id: id})
})

app.get('/stream/:id', function(req, res) {
  res.sseSetup()
  var sessionKey = req.params.id
  if (sessionKey) {
    var header = sessions[sessionKey].header
    var waitingConnections = sessions[sessionKey].waitingConnections
    sessions[sessionKey].connections.push(res)
    if (header) res.sseSend(header);
    else waitingConnections.push(res);
  }
})

app.listen(PORT, function() {
  console.log('Listening on port ' + PORT + '...');
})

