import React, { useEffect, useRef, useState } from 'react';

const SIGNALING_SERVER_URL = 'wss://voiceantoniosinaliza-production.up.railway.app'; // Vai substituir depois

export default function App() {
  const localAudioRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const pcRef = useRef(null);
  const wsRef = useRef(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    wsRef.current = new WebSocket(SIGNALING_SERVER_URL);

    wsRef.current.onopen = () => {
      console.log('Conectado ao servidor de sinalização');
      setConnected(true);
    };

    wsRef.current.onmessage = async (message) => {
      const data = JSON.parse(message.data);
      switch (data.type) {
        case 'offer':
          await handleOffer(data.offer);
          break;
        case 'answer':
          await handleAnswer(data.answer);
          break;
        case 'ice-candidate':
          if (data.candidate) {
            await pcRef.current.addIceCandidate(data.candidate);
          }
          break;
        default:
          break;
      }
    };

    wsRef.current.onerror = (err) => console.error('Erro WebSocket:', err);
    wsRef.current.onclose = () => {
      console.log('WebSocket fechado');
      setConnected(false);
    };

    startConnection();

    return () => {
      wsRef.current.close();
      if (pcRef.current) pcRef.current.close();
    };
  }, []);

pcRef.current = new RTCPeerConnection({
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    {
      urls: 'turn:turn.anyfirewall.com:443?transport=tcp',
      username: 'webrtc',
      credential: 'webrtc'
    }
  ]
});


    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => {
      pcRef.current.addTrack(track, stream);
    });
    if (localAudioRef.current) localAudioRef.current.srcObject = stream;

    pcRef.current.ontrack = (event) => {
      if (remoteAudioRef.current) remoteAudioRef.current.srcObject = event.streams[0];
    };

    pcRef.current.onicecandidate = (event) => {
      if (event.candidate) {
        wsRef.current.send(JSON.stringify({ type: 'ice-candidate', candidate: event.candidate }));
      }
    };

    const offer = await pcRef.current.createOffer();
    await pcRef.current.setLocalDescription(offer);

    wsRef.current.send(JSON.stringify({ type: 'offer', offer }));
  }

  async function handleOffer(offer) {
    if (!pcRef.current) await startConnection();

    await pcRef.current.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pcRef.current.createAnswer();
    await pcRef.current.setLocalDescription(answer);

    wsRef.current.send(JSON.stringify({ type: 'answer', answer }));
  }

  async function handleAnswer(answer) {
    await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Chat de Voz por Proximidade</h1>
      <p>Status: {connected ? 'Conectado' : 'Desconectado'}</p>
      <audio ref={localAudioRef} autoPlay muted controls />
      <audio ref={remoteAudioRef} autoPlay controls />
      <p>Abra em outra aba para testar a conexão.</p>
    </div>
  );
}
