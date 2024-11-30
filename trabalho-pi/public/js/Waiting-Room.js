// Função para gerar ou recuperar o UUID do dispositivo
function getUUID() {
    let deviceUUID = localStorage.getItem("deviceUUID");
    if (!deviceUUID) {
      deviceUUID = generateUUID();
      checkAndRegisterUUID(deviceUUID);
      localStorage.setItem("deviceUUID", deviceUUID);
    }
    console.log("3", deviceUUID);
    return deviceUUID;    
  }
  
  // Função para gerar um novo UUID
  function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0,
          v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
  
  // Função para enviar o UUID ao servidor e verificar se ele já existe no banco
  function checkAndRegisterUUID(deviceUUID) {
    fetch('/api/registrar-uuid', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ deviceUUID: deviceUUID }),
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        console.log("UUID registrado com sucesso.");
      } else if (data.error === "UUID já existe") {
        // Se o UUID já existe, gera um novo
        console.log("UUID já existe, gerando um novo...");
        const newUUID = generateUUID();
        localStorage.setItem("deviceUUID", newUUID);
        checkAndRegisterUUID(newUUID); // Registrar o novo UUID
      }
    })
    .catch(error => console.error('Erro ao registrar o UUID:', error));
  }
  
  // Função para enviar o ping ao servidor e manter o dispositivo ativo
  function sendPing(deviceUUID) {
    fetch('/api/check-devices', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ deviceUUID: deviceUUID }),
    })
    .then(response => response.json())
    .then(data => {
      if (data.active) {
        console.log('Dispositivo ativo');
      }
    })
    .catch(error => console.error('Erro ao enviar o ping:', error));
  }
  
  // Função para verificar e enviar ping periodicamente
  function checkDeviceStatus(deviceUUID) {
    setInterval(() => {
      sendPing(deviceUUID);
    }, 10 * 1000);
  }

// Função para iniciar a reprodução no display principal
function playOnMainDisplay(playlistId) {
  console.log(`Reproduzindo playlist ${playlistId}`);
  window.location.href = `/display?id=${playlistId}`;
}

document.addEventListener("DOMContentLoaded", () => {
  const deviceUUID = getUUID();
  
  if (!deviceUUID) {
    console.log("UUID não encontrado");
    return;
  }

  const eventSource = new EventSource(`/api/waiting?uuid=${deviceUUID}`);

  eventSource.onmessage = (event) => {
    try {
      const playlistData = JSON.parse(event.data);
      
      if (playlistData && playlistData.playlistID) {
        playOnMainDisplay(playlistData.playlistID);
        eventSource.close();
      }
    } catch (error) {
      console.error('Erro ao processar dados da playlist:', error);
    }
  };

  eventSource.onerror = (error) => {
    console.error('Erro na conexão SSE:', error);
    eventSource.close();
  };
});