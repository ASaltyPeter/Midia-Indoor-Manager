export class Player {
    constructor() {
        this.lstArquivos = []; // Lista de arquivos da playlist
        this.pAtual = 0; // Índice do arquivo atual
        this.intervalos = null; // Identificador do intervalo de exibição
        this.CACHE_NAME = 'ArquivosPlayList'; // Nome do cache
    }

    async fetchPlaylistData(playlistId) {
        try {
            const response = await fetch(`/api/edit/${playlistId}`);
            const json = await response.json();

            const items = json.playlist.items;


            this.lstArquivos = items.map(item => 
                new Arquivo(this.getLink(item.type, item.id), this.getType(item.type))
            );

            const lstPromise = this.lstArquivos.map(arq => this.baixarArquivo(arq));
            await Promise.all(lstPromise);

            this.mostrarArquivo(); // Inicia a exibição dos arquivos
        } catch (error) {
            console.error("Erro ao carregar a playlist:", error);
        }
    }

    getLink(type, id) {
        switch (type) {
            case 'image': return `/images/${id}`;
            case 'video': return `/videos/${id}`;
            case 'text': return '/text/'+this.getIdFromJson(id);
            default: return null;
        }
    }

    getIdFromJson(jsonString) {
        const data = JSON.parse(jsonString);
        return data.id;
    }

    getType(type) {
        switch (type) {
            case 'image': return 1;
            case 'video': return 2;
            case 'text': return 3;
            default: return null;
        }
    }

    async baixarArquivo(arq) {
        const cache = await caches.open(this.CACHE_NAME);
        
        // Verifica se o arquivo já está no cache
        const cachedResponse = await cache.match(arq.link);
        if (cachedResponse) {
            if (arq.tipo === 3) {  // Caso seja um arquivo de texto
                const json = await cachedResponse.json();
                arq.dados = json.content;
                
                // Verifica se há imagem de fundo
                if (json.has_background === 1 && json.image_id !== null) {
                    arq.background = `/images/${json.image_id}`;
                    // Força o download da imagem de fundo, se não estiver no cache
                    await this.baixarImagemFundo(arq.background);
                } else {
                    arq.background = null;
                }
            } else {
                const blob = await cachedResponse.blob();
                arq.dados = URL.createObjectURL(blob);
            }
            return;
        }
        
        // Faz o download e armazena no cache
        try {
            const response = await fetch(arq.link);
            if (!response.ok) throw new Error(`Erro ao baixar arquivo: ${arq.link}`);
            
            const responseClone = response.clone();
            if (arq.tipo === 3) {  // Se for texto
                const textData = await response.json();
                arq.dados = textData.content;
                
                // Verifica se há imagem de fundo
                if (textData.has_background === 1 && textData.image_id !== null) {
                    arq.background = `/images/${textData.image_id}`;
                    // Força o download da imagem de fundo, se não estiver no cache
                    await this.baixarImagemFundo(arq.background);
                } else {
                    arq.background = null;
                }
            } else {
                const blob = await response.blob();
                arq.dados = URL.createObjectURL(blob);
            }
            
            await cache.put(arq.link, responseClone);
        } catch (error) {
            arq.erro = error;
            console.error(`Erro ao baixar o arquivo ${arq.link}:`, error);
        }
    }
    
    // Função para baixar e armazenar a imagem de fundo no cache
    async baixarImagemFundo(backgroundLink) {
        try {
            const cache = await caches.open(this.CACHE_NAME);
            const cachedBackground = await cache.match(backgroundLink);
            
            if (!cachedBackground) {
                const response = await fetch(backgroundLink);
                if (!response.ok) throw new Error(`Erro ao baixar imagem de fundo: ${backgroundLink}`);
                const responseClone = response.clone();
                await cache.put(backgroundLink, responseClone);
            }
        } catch (error) {
            console.error(`Erro ao baixar a imagem de fundo ${backgroundLink}:`, error);
        }
    }
    
    
    mostrarArquivo() {
        this.pararTempo();
    
        if (this.lstArquivos.length === 0) {
            console.error("Nenhum arquivo disponível para exibição.");
            return;
        }
    
        const arq = this.lstArquivos[this.pAtual];
        if (!arq || arq.erro) {
            console.error(`Erro no arquivo: ${arq ? arq.link : 'Arquivo inválido'}`);
            return;
        }
    
        const canvas = document.querySelector("#canvas");
        const reprodutor = document.querySelector("#reprodutor");
        if (!canvas || !reprodutor) {
            console.error("Elemento #canvas ou #reprodutor não encontrado.");
            return;
        }
    
        // Limpa o conteúdo anterior do canvas
        canvas.innerHTML = "";
    
        if (arq.tipo === 1) { // Imagem
            const img = document.createElement("img");
            img.src = arq.dados;
            img.alt = arq.link;
            canvas.appendChild(img);
            this.iniciarTempo();
        } else if (arq.tipo === 2) { // Vídeo
            const video = document.createElement("video");
            video.src = arq.dados;
            video.autoplay = true;
            video.muted = true;
            video.onended = () => this.mostrarArquivo();
            canvas.appendChild(video);
            this.iniciarTempo();
        } else if (arq.tipo === 3) { // Texto
            const div = document.createElement("div");
            div.className = "texto";
            div.innerHTML = arq.dados;
    
            // Se houver background, configura-lo
            if (arq.background) {
                const backgroundPath = `${arq.background}`;
                div.style.backgroundImage = `url('${backgroundPath}')`;
            }
    
            canvas.appendChild(div);
            this.iniciarTempo();
        }
    
        this.pAtual = (this.pAtual + 1) % this.lstArquivos.length;
    }
  
    iniciarTempo() {
        this.intervalos = setInterval(() => this.mostrarArquivo(), 5000);
    }

    pararTempo() {
        if (this.intervalos) {
            clearInterval(this.intervalos);
            this.intervalos = null;
        }
    }
}

class Arquivo {
    constructor(link, tipo) {
        this.link = link;
        this.tipo = tipo;
        this.dados = null;
        this.erro = null;
    }
}

function moveBackToWaiting() {
    window.location.href = `/waiting`;
};

// Lógica de inicialização do player
document.addEventListener('DOMContentLoaded', () => {
    const player = new Player();
    const urlParams = new URLSearchParams(window.location.search);
    const playlistId = urlParams.get('id');
    const deviceUUID = localStorage.getItem("deviceUUID");

    if (playlistId) {
        player.fetchPlaylistData(playlistId);
    }

    if (!deviceUUID) {
        console.log("UUID do dispositivo não encontrado. Redirecionando para a sala de espera.");
        moveBackToWaiting();
        return;
    }
    const eventSource = new EventSource(`/api/waiting?uuid=${deviceUUID}`);

    eventSource.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);

            if (data.removed) {
                console.log("UUID não encontrado. Redirecionando para a sala de espera.");
                eventSource.close();
                moveBackToWaiting();
                return;
            }

            if (data.playlist) {
                console.log("Playlist recebida:", data.playlist);
            }
        } catch (error) {
            console.error("Erro ao processar mensagem do servidor:", error);
        }
    };

    eventSource.onerror = (error) => {
        console.error("Erro na conexão SSE:", error);
        moveBackToWaiting();
        eventSource.close();
    };

    if (!playlistId) {
        console.error("ID da playlist não especificado.");
        return;
    }

    player.fetchPlaylistData(playlistId);
});
