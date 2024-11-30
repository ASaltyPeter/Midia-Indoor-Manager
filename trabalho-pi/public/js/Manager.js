window.onload = async function() {
    await loadDevices();
    await loadActivePlaybacks();
};

let Devices = [];
let deviceUUID = 0;
let playlistID = 0;

async function loadDevices() {
    try {
        const response = await fetch('/api/list-devices');
        const data = await response.json();
        console.log(data);
        Devices = data.devices;
        console.log(Devices);

        createDeviceDivs();
    } catch (error) {
        console.error('Erro ao carregar dispositivos:', error);
    }
}

function createDeviceDivs() {
    const devicesContainer = document.getElementById('computersContainer');
    devicesContainer.innerHTML = '';

    Devices.forEach((device, index) => {
        const deviceElement = document.createElement('div');
        deviceElement.classList.add('computer');

        const iconElement = document.createElement('div');
        iconElement.classList.add('icon');

        const iconSpan = document.createElement('span');
        iconSpan.classList.add('material-icons');
        iconSpan.textContent = 'computer';

        const deviceName = document.createElement('p');
        deviceName.classList.add('device-name');
        deviceName.textContent = device.name;
        deviceName.setAttribute('data-uuid', device.uuid);

        const statusDot = document.createElement('span');
        statusDot.classList.add('status-dot');
        statusDot.style.backgroundColor = device.active ? 'green' : 'gray';

        const editIcon = document.createElement('span');
        editIcon.classList.add('material-icons', 'edit-icon');
        editIcon.textContent = 'edit';
        editIcon.setAttribute('onclick', `editDeviceName(${index})`);

        const deleteIcon = document.createElement('span');
        deleteIcon.classList.add('material-icons', 'delete-icon');
        deleteIcon.textContent = 'delete';
        deleteIcon.setAttribute('onclick', `removeDevice(${index})`);

        iconElement.appendChild(iconSpan);
        iconElement.appendChild(deviceName);
        iconElement.appendChild(statusDot);
        iconElement.appendChild(editIcon);
        iconElement.appendChild(deleteIcon);

        deviceElement.appendChild(iconElement);
        devicesContainer.appendChild(deviceElement);

        deviceElement.addEventListener('click', () => {
            saveUUID(device.uuid);
            openPlaylistCatalog();
        });
        loadActivePlaybacks();
    });
}

function saveUUID(uuid){
    return deviceUUID = uuid;
}

function saveID(id){
    return playlistID = id;
}

function resetIDS(){
    return deviceUUID, playlistID = 0;
}


async function editDeviceName(index) {
    const device = Devices[index];
    const deviceNameElement = document.querySelectorAll('.device-name')[index];
    
    // Use prompt to get the new device name
    const newName = prompt("Enter a new name for the device:", device.name);
    
    // Check if user didn't cancel the prompt
    if (newName !== null && newName.trim() !== '') {
        try {
            // Send request to update device name
            const response = await fetch('/api/update-device', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    uuid: device.uuid, // Assuming the device object has a uuid property
                    name: newName.trim()
                })
            });

            const result = await response.json();

            if (result.success) {
                // Update the device name in the local array
                device.name = newName.trim();
                
                // Update the displayed name
                deviceNameElement.textContent = newName.trim();

                // Optional: Show a success message
                alert(result.message);
            } else {
                // Show error message if update failed
                alert(result.message);
            }
        } catch (error) {
            console.error('Error updating device name:', error);
            alert('Failed to update device name. Please try again.');
        }
    }
}

async function saveDeviceName(input, index) {
    const deviceName = input.value.trim() || "Dispositivo";

    const deviceNameElement = document.createElement("p");
    deviceNameElement.className = "device-name";
    deviceNameElement.textContent = deviceName;

    input.replaceWith(deviceNameElement);

    Devices[index].name = deviceName;

    await updateDeviceName(Devices[index].uuid, deviceName);
}

async function updateDeviceName(uuid, name) {
    try {
        await fetch('/api/update-device', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ uuid: uuid, name: name })
        });
    } catch (error) {
        console.error('Erro ao atualizar o nome:', error);
    }
}

function removeDevice(index) {
    const device = Devices[index];
    if (confirm(`Deseja realmente remover o dispositivo: ${device.name}?`)) {
        removeDeviceFromDatabase(device.uuid);
        Devices.splice(index, 1);
        createDeviceDivs();
    }
}

async function removeDeviceFromDatabase(uuid) {
    try {
        await fetch('/api/remove-device', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ uuid: uuid })
        });
    } catch (error) {
        console.error('Erro ao remover o dispositivo do banco de dados:', error);
    }
}

function openPlaylistCatalog() {
    const modal = document.getElementById("playlist-modal");
    modal.style.display = "block";

    loadPlaylists(8);
}

function closePlaylistCatalog() {
    const modal = document.getElementById("playlist-modal");
    modal.style.display = "none";
}

    // Função para carregar as playlists
async function loadPlaylists(limit) {
    const response = await fetch(`/api/playlists?offset=0&limit=${limit}`);
    const data = await response.json();
    const playlists = data.playlists || [];

    const playlistCatalog = document.getElementById("playlist-catalog");
    playlistCatalog.innerHTML = ""; // Limpar o catálogo antes de adicionar os novos cards

    playlists.forEach(playlist => {
    const card = document.createElement("div");
    card.classList.add("card");
    card.innerHTML = `
        <img src="/api/images/${playlist.coverId}" alt="Capa da Playlist">
        <div class="card-title">${playlist.name}</div>
        <div class="card-overlay">
        <div class="left-half" onclick="playPlaylist(${playlist.id})">▶️</div>
        </div>
    `;
    playlistCatalog.appendChild(card);
    });
}

// Função de reprodução (ao clicar em uma playlist)
function playPlaylist(id) {
    console.log(`Reproduzindo playlist ${id}`);
    playlistID = saveID(id);
    startPlayer(deviceUUID, playlistID);
    console.log(playlistID);
    console.log(deviceUUID);
    closePlaylistCatalog();   
    resetIDS();
    refreshDevicesAndPlaybacks();    
}

async function refreshDevicesAndPlaybacks() {
    try {
        // Recarregar dispositivos
        await loadDevices();
        // Recarregar reproduções ativas
        await loadActivePlaybacks();
    } catch (error) {
        console.error('Erro ao atualizar dispositivos e reproduções ativas:', error);
    }
}


async function loadActivePlaybacks() {
    try {
        const response = await fetch('/api/active-playbacks');
        const data = await response.json();
        
        data.activePlaybacks.forEach(playback => {
            const deviceElement = document.querySelector(
                `.computer .device-name[data-uuid="${playback.deviceUUID}"]`
            );
            
            if (deviceElement) {
                // Primeiro, remova qualquer botão de stop existente
                const existingStopButton = deviceElement.querySelector('.stop-playback');
                if (existingStopButton) {
                    existingStopButton.remove();
                }

                // Adicione o novo botão de stop
                const stopButton = document.createElement('span');
                stopButton.classList.add('material-icons', 'stop-playback');
                stopButton.textContent = 'stop_circle';
                stopButton.title = 'Finalizar Reprodução';
                stopButton.onclick = (e) => {
                    e.stopPropagation(); // Prevent parent click
                    cancelPlayback(playback.deviceUUID, playback.playlistID);
                };
                
                deviceElement.appendChild(stopButton);
                
                // Adicione o atributo data-uuid se não existir
                if (!deviceElement.getAttribute('data-uuid')) {
                    deviceElement.setAttribute('data-uuid', playback.deviceUUID);
                }
            }
        });
    } catch (error) {
        console.error('Erro ao carregar reproduções ativas:', error);
    }
}

async function startPlayer(uuid, id) {
    console.log(id);
    try {
        await fetch('/api/start-player', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                deviceUUID: uuid,
                playlistID: id
            })
        });

        console.log(`Solicitação de reprodução enviada para o dispositivo ${uuid} com a playlist ID ${id}`);
    } catch (error) {
        console.error('Erro ao iniciar a reprodução no servidor:', error);
    }
}

async function cancelPlayback(deviceUUID, playlistID) {
    try {
        const response = await fetch('/api/cancel-playback', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                deviceUUID, 
                playlistID 
            })
        });

        const data = await response.json();
        
        loadActivePlaybacks();
        loadDevices();
    } catch (error) {
        console.error('Erro ao finalizar reprodução:', error);
    }
}


