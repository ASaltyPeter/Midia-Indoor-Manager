document.addEventListener("DOMContentLoaded", () => {
  let offset = 0;
  const initialLimit = 8; // Limite inicial de 8 playlists
  const subsequentLimit = 9; // Limite de 9 playlists para cargas subsequentes

  const playlistsGrid = document.getElementById("playlists-grid");

  // Função para buscar playlists do backend
  async function fetchPlaylists(offset, limit) {
    try {
      if (isNaN(offset) || isNaN(limit)) {
        throw new Error("Offset e limit devem ser números válidos.");
      }

      const response = await fetch(`/api/playlists?offset=${offset}&limit=${limit}`);
      
      if (!response.ok) {
        throw new Error(`Erro ao buscar playlists: ${response.statusText}`);
      }

      const data = await response.json();
      console.log("Dados recebidos:", data);
      return data.playlists || [];
    } catch (error) {
      console.error("Erro ao buscar playlists:", error);
      return [];
    }
  }

  // Função para renderizar playlists no grid
  function renderPlaylists(playlists) {
    playlists.forEach(playlist => {
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <img src="/api/images/${playlist.coverId}" alt="Capa da Playlist">
        <div class="card-title">${playlist.name}</div>
        <div class="card-overlay">
          <div class="left-half" onclick="playPlaylist(${playlist.id})">▶️</div>
          <div class="right-half" onclick="editPlaylist(${playlist.id})">✏️</div>
        </div>
      `;
      playlistsGrid.appendChild(card);
    });
  }

  // Função para carregar playlists
  async function loadPlaylists(limit) {
    const playlists = await fetchPlaylists(offset, limit);

    if (offset === 0) {
      // Adiciona o card fixo para criar nova playlist
      const newCard = document.createElement("div");
      newCard.className = "card create-card";
      newCard.innerHTML = `
        <div class="card-title">Criar Nova Playlist</div>
        <div class="card-overlay">
          <div class="center-button" onclick="createNewPlaylist()">+</div>
        </div>
      `;
      playlistsGrid.appendChild(newCard);
    }

    if (playlists.length) {
      renderPlaylists(playlists);
      offset += playlists.length; // Atualiza o offset
    }
  }

  // Função de reprodução
  window.playPlaylist = (id) => {
    console.log(`Reproduzindo playlist ${id}`);
    window.location.href = `/player?id=${id}`;
  };

  // Função de edição
  window.editPlaylist = (id) => {
    console.log(`Editando playlist ${id}`);
    window.location.href = `/edit?id=${id}`;
  };

  // Função para carregamento infinito ao rolar a página
  function checkScroll() {
    if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 100) {
      loadPlaylists(subsequentLimit); // Carrega 9 playlists em cada rolagem adicional
    }
  }

  // Adiciona evento de scroll para carregamento infinito
  window.addEventListener("scroll", checkScroll);

  // Inicializa o grid com o card de criação e playlists
  loadPlaylists(initialLimit); // Carrega 8 playlists no primeiro carregamento
});

function createNewPlaylist() {
  console.log("Criando nova playlist...");
  window.location.href = "/create";
}