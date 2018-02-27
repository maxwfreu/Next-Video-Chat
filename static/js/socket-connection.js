const SocketConnection = (socket, localVideo, remoteVideo) => {
  this.socket = socket;
  this.localVideo = localVideo;
  this.remoteVideo = remoteVideo;
  this.isChannelReady = false;
  this.isInitiator = false;
  this.isStarted = false;
  this.turnReady = false;
  this.localStream;
  this.pc = null;
  this.remoteStream = null;
  this.pcConfig = {
    'iceServers': [{
      'urls': 'stun:stun.l.google.com:19302'
    }]
  };
  // Set up audio and video regardless of what devices are present.
  this.sdpConstraints = {
    offerToReceiveAudio: true,
    offerToReceiveVideo: true
  };
  this.room = 'test' // Can prompt user
  this.constraints = {
    video: true,
    audio: true,
  };
  const self = this;
  // Functions

  this.setupSocket = (socket) => {
    if (self.room !== '') {
      socket.emit('create or join', self.room);
      console.log('Attempted to create or  join room', self.room);
    }

    socket.on('created', function(room) {
      console.log('Created room ' + room);
      self.isInitiator = true;
    });

    socket.on('full', function(room) {
      console.log('Room ' + room + ' is full');
    });

    socket.on('join', function (room){
      console.log('Another peer made a request to join room ' + room);
      console.log('This peer is the initiator of room ' + room + '!');
      self.isChannelReady = true;
    });

    socket.on('joined', function(room) {
      console.log('joined: ' + room);
      self.isChannelReady = true;
    });

    socket.on('log', function(array) {
      console.log.apply(console, array);
    });

    socket.on('message', function(message) {
      console.log('Client received message:', message);
      if (message === 'got user media') {
        self.maybeStart();
      } else if (message.type === 'offer') {
        if (!self.isInitiator && !self.isStarted) {
          self.maybeStart();
        }
        self.pc.setRemoteDescription(new RTCSessionDescription(message));
        self.doAnswer();
      } else if (message.type === 'answer' && self.isStarted) {
        self.pc.setRemoteDescription(new RTCSessionDescription(message));
      } else if (message.type === 'candidate' && self.isStarted) {
        var candidate = new RTCIceCandidate({
          sdpMLineIndex: message.label,
          candidate: message.candidate
        });
        self.pc.addIceCandidate(candidate);
      } else if (message === 'bye' && self.isStarted) {
        self.handleRemoteHangup();
      }
    });
  }

  this.sendMessage = (message) => {
    console.log('Client sending message: ', message);
    socket.emit('message', message);
  }

  this.gotStream = (stream) => {
    console.log('Adding local stream.');
    self.localStream = stream;
    self.localVideo.srcObject = stream;
    self.sendMessage('got user media');
    if (self.isInitiator) {
      self.maybeStart();
    }
  }

  this.maybeStart = () => {
    console.log('>>>>>>> maybeStart() ', self.isStarted, self.localStream, self.isChannelReady);
    if (!self.isStarted && typeof self.localStream !== 'undefined' && self.isChannelReady) {
      console.log('>>>>>> creating peer connection');
      self.createPeerConnection();
      self.pc.addStream(self.localStream);
      self.isStarted = true;
      console.log('isInitiator', self.isInitiator);
      if (self.isInitiator) {
        self.doCall();
      }
    }
  }

  this.createPeerConnection = () => {
    try {
      self.pc = new RTCPeerConnection(null);
      self.pc.onicecandidate = self.handleIceCandidate;
      self.pc.onaddstream = self.handleRemoteStreamAdded;
      self.pc.onremovestream = self.handleRemoteStreamRemoved;
      console.log('Created RTCPeerConnnection');
    } catch (e) {
      console.log('Failed to create PeerConnection, exception: ' + e.message);
      alert('Cannot create RTCPeerConnection object.');
      return;
    }
  }

  this.handleIceCandidate = (event) => {
    console.log('icecandidate event: ', event);
    if (event.candidate) {
      self.sendMessage({
        type: 'candidate',
        label: event.candidate.sdpMLineIndex,
        id: event.candidate.sdpMid,
        candidate: event.candidate.candidate
      });
    } else {
      console.log('End of candidates.');
    }
  }

  this.handleCreateOfferError = (event) => {
    console.log('createOffer() error: ', event);
  }

  this.doCall = () => {
    console.log('Sending offer to peer');
    self.pc.createOffer(self.setLocalAndSendMessage, self.handleCreateOfferError);
  }

  this.doAnswer = () => {
    console.log('Sending answer to peer.');
    self.pc.createAnswer().then(
      self.setLocalAndSendMessage,
      self.onCreateSessionDescriptionError
    );
  }

  this.setLocalAndSendMessage = (sessionDescription) => {
    // Set Opus as the preferred codec in SDP if Opus is present.
    //  sessionDescription.sdp = preferOpus(sessionDescription.sdp);
    self.pc.setLocalDescription(sessionDescription);
    console.log('setLocalAndSendMessage sending message', sessionDescription);
    self.sendMessage(sessionDescription);
  }

  this.onCreateSessionDescriptionError = (error) => {
    trace('Failed to create session description: ' + error.toString());
  }

  this.requestTurn = (turnURL) => {
    var turnExists = false;
    for (var i in self.pcConfig.iceServers) {
      if (self.pcConfig.iceServers[i].urls.substr(0, 5) === 'turn:') {
        turnExists = true;
        self.turnReady = true;
        break;
      }
    }
    if (!turnExists) {
      console.log('Getting TURN server from ', turnURL);
      // No TURN server. Get one from computeengineondemand.appspot.com:
      var xhr = new XMLHttpRequest();
      xhr.onreadystatechange = function() {
        if (xhr.readyState === 4 && xhr.status === 200) {
          var turnServer = JSON.parse(xhr.responseText);
          console.log('Got TURN server: ', turnServer);
          self.pcConfig.iceServers.push({
            'urls': 'turn:' + turnServer.username + '@' + turnServer.turn,
            'credential': turnServer.password
          });
          self.turnReady = true;
        }
      };
      xhr.open('GET', turnURL, true);
      xhr.send();
    }
  }

  this.handleRemoteStreamAdded = (event) => {
    console.log('Remote stream added.');
    remoteStream = event.stream;
    remoteVideo.srcObject = remoteStream;
  }

  this.handleRemoteStreamRemoved = (event) => {
    console.log('Remote stream removed. Event: ', event);
  }

  this.hangup = () => {
    console.log('Hanging up.');
    self.stop();
    self.sendMessage('bye');
  }

  this.handleRemoteHangup = () => {
    console.log('Session terminated.');
    self.stop();
    self.isInitiator = false;
  }

  this.stop = () => {
    self.isStarted = false;
    self.pc.close();
    self.pc = null;
  }

  ///////////////////////////////////////////

  // Set Opus as the default audio codec if it's present.
  this.preferOpus = (sdp) => {
    var sdpLines = sdp.split('\r\n');
    var mLineIndex;
    // Search for m line.
    for (var i = 0; i < sdpLines.length; i++) {
      if (sdpLines[i].search('m=audio') !== -1) {
        mLineIndex = i;
        break;
      }
    }
    if (mLineIndex === null) {
      return sdp;
    }

    // If Opus is available, set it as the default in m line.
    for (i = 0; i < sdpLines.length; i++) {
      if (sdpLines[i].search('opus/48000') !== -1) {
        var opusPayload = this.extractSdp(sdpLines[i], /:(\d+) opus\/48000/i);
        if (opusPayload) {
          sdpLines[mLineIndex] = this.setDefaultCodec(sdpLines[mLineIndex],
            opusPayload);
        }
        break;
      }
    }

    // Remove CN in m line and sdp.
    sdpLines = this.removeCN(sdpLines, mLineIndex);

    sdp = sdpLines.join('\r\n');
    return sdp;
  }

  this.extractSdp = (sdpLine, pattern) => {
    var result = sdpLine.match(pattern);
    return result && result.length === 2 ? result[1] : null;
  }

  // Set the selected codec to the first in m line.
  this.setDefaultCodec = (mLine, payload) => {
    var elements = mLine.split(' ');
    var newLine = [];
    var index = 0;
    for (var i = 0; i < elements.length; i++) {
      if (index === 3) { // Format of media starts from the fourth.
        newLine[index++] = payload; // Put target payload to the first.
      }
      if (elements[i] !== payload) {
        newLine[index++] = elements[i];
      }
    }
    return newLine.join(' ');
  }

  // Strip CN from sdp before CN constraints is ready.
  this.removeCN = (sdpLines, mLineIndex) => {
    var mLineElements = sdpLines[mLineIndex].split(' ');
    // Scan from end for the convenience of removing an item.
    for (var i = sdpLines.length - 1; i >= 0; i--) {
      var payload = this.extractSdp(sdpLines[i], /a=rtpmap:(\d+) CN\/\d+/i);
      if (payload) {
        var cnPos = mLineElements.indexOf(payload);
        if (cnPos !== -1) {
          // Remove CN payload from m line.
          mLineElements.splice(cnPos, 1);
        }
        // Remove CN line in sdp
        sdpLines.splice(i, 1);
      }
    }

    sdpLines[mLineIndex] = mLineElements.join(' ');
    return sdpLines;
  }

  this.connect = () => {
    this.setupSocket(socket);
    navigator.mediaDevices.getUserMedia(self.constraints)
    .then(self.gotStream)
    .catch(function(e) {
      alert('getUserMedia() error: ' + e.name);
    });

    if (location.hostname !== 'localhost') {
      this.requestTurn(
        'https://computeengineondemand.appspot.com/turn?username=41784574&key=4080218913'
      );
    }

    window.onbeforeunload = function() {
      self.sendMessage('bye');
    };
  }

  this.connect();
}

module.exports = {
  SocketConnection,
}
