import React, { Component } from 'react';
import io from 'socket.io-client'
import fetch from 'isomorphic-unfetch'
import { SocketConnection } from '../static/js/socket-connection.js';

export default class Video extends Component {
  constructor() {
    super();
    this.state = {
      rendered: false,
      started: false,
    }
    this.setupListeners = this.setupListeners.bind(this);
    this.start = this.start.bind(this);
  }

  componentDidMount () {
    const localVideo = document.querySelector('#localVideo');
    const remoteVideo = document.querySelector('#remoteVideo');
    this.socket = io()
  }

  setupListeners() {
    this.socket.on('join', ()=>{
      this.setState({
        loadedPeer: true,
      });
    });
    this.socket.on('joined', ()=>{
      this.setState({
        loadedPeer: true,
      });
    });
    this.socket.on('message', (message) => {
      if(message === 'bye') {
        this.setState({
          loadedPeer: false,
        });
      }
    });
  }

  start() {
    this.setupListeners();
    SocketConnection(this.socket, localVideo, remoteVideo);
    this.setState({
      started: true,
    });
  }

  // close socket connection
  componentWillUnmount () {
    this.socket.close()
  }

  render() {
    const renderedClass = this.state.loadedPeer ? 'rendered' : '';
    const startedClass = this.state.started ? 'started' : '';

    return(
      <div className="wrap">
        <button className={startedClass} onClick={this.start}> Connect </button>
        <div id="videos">
          <video id="localVideo" className={renderedClass} autoPlay muted playsInline></video>
          <video id="remoteVideo" className={renderedClass} autoPlay playsInline></video>
        </div>
        <style jsx>{`
          .wrap {
            min-height: 100vh;
          }
          div {
            position: relative;
          }
          #remoteVideo {
            display: none;
          }

          #localVideo, #remoteVideo  {
            width: 100%;
            max-height: 100vh;
            height: auto;
            max-width: 1400px;
            transition: all 1s ease;
          }

          #localVideo.rendered {
            position: absolute;
            right: 0;
            bottom: 20px;
            height: auto;
            max-width: 250px;
            width: 15%;
          }
          #remoteVideo.rendered {
            display: inline;
          }

          button {
            position: absolute;
            bottom: 20px;
            background-color: dodgerblue;
            height: 50px;
            width: 150px;
            border: transparent;
            border-radius: 5px;
            color: white;
            margin: 0;
            top: 50%;
            left: 50%;
            margin-right: -50%;
            transform: translate(-50%, -50%);
            cursor: pointer;
            z-index: 9999;
          }

          button.started {
            display: none;
          }
        `}</style>
      </div>
    )
  }
}
