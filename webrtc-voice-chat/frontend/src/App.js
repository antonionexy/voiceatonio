import React, { useEffect, useRef, useState } from 'react';

const SIGNALING_SERVER_URL = process.env.voiceantoniosinaliza-production.up.railway.app;

export default function App() {
  const [localStream, setLocalStream] = useState(null);
  const ws = useRef(null);
  const peers = useRef(new Map()); // Map peerId -> RTCPeerConnection
  const localAudioRef = useRef(null);
  const [connectedPeers, setConnectedPeers] = useState([]);

  // Simule posição do jogador — você deve substituir pela posição real
  const getPlayerPosition = () => {
    // Exemplo fixo, substitua pela posição do Minecraft
    return { x: Math.random() * 100, y: 64, z: Math.random() * 100 };
  };

  useEffect(() => {
    // Captura áudio local
    async function startLocalStream() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setLocalStream(stream);
        if (localAudioRef.current) {
          localAudioRef.current.srcObject = stream;
        }
      } catch (e) {
        console.error('Erro ao acessar microfone', e);
      }
    }
    startLocalStream();
  }, []);

  useEffect(() => {
    if (!localStream) return;

    ws.current = new WebSocket(SIGNALING_SERVER_URL);

    ws.current.onopen = () => {
      console.log('Conectado ao servidor de sinalização');
      sendPositionPeriodically();
    };

    ws.current.onmessage = async (message) => {
      const data = JSON.parse(message.data);
      const { from, type, payload } = data;

      if (from === 'self') return; // Ignore mensagens próprias (ajuste conforme seu backend)

      if (type === 'offer') {
        await handleOffer(from, payload);
      } else if (type === 'answer') {
        await handleAnswer(from, payload);
      } else if (type === 'ice-candidate') {
        await handleIceCandidate(from, payload);
      }
    };

    ws.current.onclose = () => {
      console.log('Desconectado do servidor de sinalização');
      peers.current.forEach(pc => pc.close());
      peers.current.clear();
      setConnectedPeers([]);
    };

    return () => {
      if (ws.current) ws.current.close();
    };
  }, [localStream]);

  // Enviar posição a cada 1 segundo
  const sendPositionPeriodically = () => {
    setInterval(() => {
      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        const pos = getPlayerPosition();
        ws.current.send(
          JSON.stringify({
            type: 'position',
            x: pos.x,
            y: pos.y,
            z: pos.z,
          }),
        );
      }
    }, 1000);
  };

  // Criar conexão WebRTC para novo peer
  const createPeerConnection = (peerId, isOfferer) => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        {
          urls: 'turn:turn.anyfirewall.com:443?transport=tcp',
          username: 'webrtc',
          credential: 'webrtc',
        },
      ],
    });

    pc.onicecandidate = event => {
      if (event.candidate) {
        ws.current.send(
          JSON.stringify({
            to: peerId,
            type: 'ice-candidate',
            payload: event.candidate,
          }),
        );
      }
    };

    pc.ontrack = event => {
      const remoteAudio = document.getElementById(`audio-${peerId}`);
      if (remoteAudio) {
        remoteAudio.srcObject = event.streams[0];
      }
    };

    // Adiciona o stream local
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

    if (isOfferer) {
      pc.createOffer().then(offer => {
        pc.setLocalDescription(offer);
        ws.current.send(
          JSON.stringify({
            to: peerId,
            type: 'offer',
            payload: offer,
          }),
        );
      });
    }

    return pc;
  };

  const handleOffer = async (peerId, offer) => {
    if (peers.current.has(peerId)) return; // Já conectado

    const pc = createPeerConnection(peerId, false);
    peers.current.set(peerId, pc);

    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    ws.current.send(
      JSON.stringify({
        to: peerId,
        type: 'answer',
        payload: answer,
      }),
    );

    setConnectedPeers(Array.from(peers.current.keys()));
  };

  const handleAnswer = async (peerId, answer) => {
    const pc = peers.current.get(peerId);
    if (!pc) return;
    await pc.setRemoteDescription(new RTCSessionDescription(answer));
  };

  const handleIceCandidate = async (peerId, candidate) => {
    const pc = peers.current.get(peerId);
    if (!pc) return;
    await pc.addIceCandidate(new RTCIceCandidate(candidate));
  };

  return (
    <div>
      <h1>Chat de Voz por Proximidade</h1>
      <audio ref={localAudioRef} autoPlay muted />
      <h2>Conectado com: {connectedPeers.join(', ')}</h2>
      <div>
        {connectedPeers.map(peerId => (
          <audio
            key={peerId}
            id={`audio-${peerId}`}
            autoPlay
            controls
            style={{ display: 'block', marginTop: '10px' }}
          />
        ))}
      </div>
    </div>
  );
}
