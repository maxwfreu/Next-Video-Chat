import React, { Component } from 'react'
import Head from '../components/head';
import Video from '../components/video';

export default class HomePage extends React.Component {
  render () {
    return (
      <main>
        <script src="https://webrtc.github.io/adapter/adapter-latest.js"></script>
        <Head title="Home" />
        <Video />
        <style jsx global>{`
          body {
            font: 11px menlo;
            color: #fff;
            background-color: black !important;
            margin: 0 !important;
            padding: 0;
          }
        `}</style>
      </main>
    )
  }
}
