const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: process.env.PORT || 8080 });

let clients = [];

wss.on('connection', (ws) => {
  console.log('Cliente conectado');
  clients.push(ws);

  ws.on('message', (message) => {
    let data;
    try {
      data = JSON.parse(message);
    } catch {
      console.log('Mensagem inválida');
      return;
    }
    // Envia para todos os outros clientes
    clients.forEach(client => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  });

  ws.on('close', () => {
    clients = clients.filter(c => c !== ws);
    console.log('Cliente desconectado');
  });
});

console.log('Servidor de sinalização rodando na porta', process.env.PORT || 8080);
