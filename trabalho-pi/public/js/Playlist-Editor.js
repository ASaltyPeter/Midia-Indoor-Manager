class PlaylistItem {
    constructor(type, id, duration = 5) {
        this.type = type;
        this.id = id;
        this.duration = duration;
    }

    validate() {
        const validTypes = ['image', 'video', 'text'];
        return validTypes.includes(this.type) &&
               this.id &&
               typeof this.duration === 'number' &&
               this.duration > 0;
    }

    toJSON() {
        return {
            type: this.type,
            id: this.id,
            duration: this.duration
        };
    }
}

class PlaylistManager {
    constructor() {
        this.items = [];
        this.name = '';
        this.coverId = null;
        this.id = null;
    }

    addItem(type, id, duration = 5) {
        const item = new PlaylistItem(type, id, duration);
        if (item.validate()) {
            this.items.push(item);
            return true;
        }
        return false;
    }
   
    removeItem(index) {
        if (index >= 0 && index < this.items.length) {
            this.items.splice(index, 1);
        }
    }

    updateItemOrder(fromIndex, toIndex) {
        if (fromIndex >= 0 && fromIndex < this.items.length &&
            toIndex >= 0 && toIndex < this.items.length) {
            const [removed] = this.items.splice(fromIndex, 1);
            this.items.splice(toIndex, 0, removed);
        }
    }

    updateItemDuration(index, duration) {
        if (index >= 0 && index < this.items.length) {
            this.items[index].duration = duration;
        }
    }

    setName(name) {
        this.name = name.trim();
    }

    setCover(coverId) {
        this.coverId = coverId;
    }

    validate() {
        return this.name.length > 0 &&
               this.items.length > 0 &&
               this.coverId !== null;
    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            items: this.items.map(item => item.toJSON()),
            coverId: this.coverId
        };
    }

    loadFromJSON(data) {
        this.id = data.id;
        this.name = data.name;
        this.coverId = data.coverId;
        this.items = data.items.map(item => new PlaylistItem(item.type, item.id, item.duration));
    }
}

class MediaUploadManager {
    static async uploadFile(file, type) {
        const formData = new FormData();
        formData.append(type, file);

        try {
            const response = await fetch(`/api/upload-${type}`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) throw new Error('Upload failed');
            const result = await response.json();
            console.log(result);
            return result.file;
        } catch (error) {
            console.error(`Upload error for ${type}:`, error);
            throw error;
        }
    }
}

class PlaylistEditorApp {
    constructor() {
        this.playlistManager = new PlaylistManager();
        this.setupEventListeners();
        this.initializeTinyMCE();
        this.fetchRecentUploads();
    }

    setupEventListeners() {
        // Media addition triggers
        document.getElementById('add-slide').addEventListener('click', () => this.showPopup('media-popup'));
        document.getElementById('add-text-btn').addEventListener('click', () => this.showPopup('text-editor-popup'));
        document.getElementById('add-image-btn').addEventListener('click', () => this.showPopup('image-upload-popup'));
        document.getElementById('add-video-btn').addEventListener('click', () => this.showPopup('video-upload-popup'));

        // File inputs for direct upload
        document.getElementById('image-upload-input').addEventListener('change', (e) => this.handleFileUpload(e, 'image'));
        document.getElementById('video-upload-input').addEventListener('change', (e) => this.handleFileUpload(e, 'video'));
        
        // Text content saving
        document.getElementById('save-text').addEventListener('click', () => this.saveTextContent());

        // Saving the playlist
        document.getElementById('cover-drop-area').addEventListener('click', () => {
            document.getElementById('upload-cover-input').click();
        });

        document.getElementById('upload-cover-input').addEventListener('change', (event) => {
            this.handleCoverUpload(event);
        });

        // Playlist management
        document.getElementById('save-playlist').addEventListener('click', () => this.openSavePopup());
        document.getElementById('confirm-save-playlist').addEventListener('click', () => this.savePlaylist());
        
        // Popup management
        document.querySelectorAll('.btn-close').forEach(button => {
            button.addEventListener('click', (e) => this.closePopup(e.target.closest('.popup').id));
        });
    }

    async loadPlaylist(playlistId) {
        try {
          const response = await fetch(`/api/edit/${playlistId}`);
          const data = await response.json();
      
          // Verificar se a resposta foi bem-sucedida
          if (data.playlist) {
            const { name, cover_id: coverId, items } = data.playlist;
            console.log(data);
      
            // Definir os valores na playlistManager
            this.playlistManager.id = playlistId;
            this.playlistManager.setName(name);
            this.playlistManager.setCover(coverId);
      
            // Criar os objetos PlaylistItem a partir dos itens recebidos
            this.playlistManager.items = items.map(item => new PlaylistItem(item.type, item.id, item.duration));
      
            // Renderizar a playlist
            this.renderPlaylist();
          } else {
            console.error('Error fetching playlist:', data.error);
          }
        } catch (error) {
          console.error('Error fetching playlist:', error);
        }
      }
      
    async handleFileUpload(event, type) {
        const file = event.target.files[0];
        if (!file) return;
      
        try {
            const result = await MediaUploadManager.uploadFile(file, type);
            console.log(result);
            
            this.playlistManager.addItem(type, result.id, 5);
            this.renderPlaylist();
            this.fetchRecentUploads();
            const getCurrentPopupId = this.getCurrentPopupId;
            this.closePopup(getCurrentPopupId);          
        } catch (error) {
            console.error(`Error uploading ${type}:`, error);
            alert(`Erro no upload do ${type}: ${error.message}`);
        }
    }

    getCurrentPopupId() {
        const popups = document.querySelectorAll('.popup');
        for (let popup of popups) {
            if (popup.style.display === 'block') {
                return popup.id;
            }
        }
        return null;
    }

    openTextEditor() {
        // Implementar lógica para abrir o editor de texto
        console.log('Abrir editor de texto');
    }

    openSavePopup() {
        document.getElementById('playlist-name').value = this.playlistManager.name;
        this.showPopup('save-playlist-popup');
    }

    saveTextContent() {
        const editor = tinymce.get('tinymce-editor');
        const content = editor.getContent();
        const backgroundFileInput = document.getElementById('background-image');
    
        if (!backgroundFileInput || !backgroundFileInput.files.length) {
            // No background, direct text save
            this.uploadTextSlide(content, null);
            return;
        }
    
        // Upload background first, then text slide
        MediaUploadManager.uploadFile(backgroundFileInput.files[0], 'image')
            .then(result => {
                this.uploadTextSlide(content, result.id);
                console.log(result, content);
            })
            .catch(error => {
                console.error('Background upload failed', error);
                this.uploadTextSlide(content, null);
            });

    }

    uploadTextSlide(content, backgroundId) {
        fetch('/upload-text', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                content, 
                backgroundId 
            })
        })
        .then(response => response.json())
        .then(textData => {
            // Create a JSON string with all necessary information
            const textSlideData = JSON.stringify({
                id: textData.file.id,
                content: content,
                backgroundId: backgroundId
            });
    
            // Add the text item to the playlist using the stringified data
            this.playlistManager.addItem('text', textSlideData);
            this.renderPlaylist();
            
            // Reset UI
            tinymce.get('tinymce-editor').setContent('');
            document.getElementById('background-image').value = '';
            this.closePopup('text-editor-popup');
        })
        .catch(error => {
            console.error('Text slide upload failed', error);
            alert('Failed to add text slide');
        });
    }

    handleCoverUpload(event) {
        // Get the selected file from the event
        const file = event.target.files[0];
      
        // Check if a file was selected
        if (!file) return;
      
        // Create a new FileReader object to read the file content
        const reader = new FileReader();
      
        // Define a function to handle the file reading completion event
        reader.onload = (e) => {
          // Get the image preview element from the DOM
          const preview = document.getElementById('cover-preview');
      
          // Set the preview image source to the loaded file data (data URL)
          preview.src = e.target.result;
      
          // Display the preview image
          preview.style.display = 'block';
        };
      
        // Start reading the file content as a data URL
        reader.readAsDataURL(file);
      
        // Use MediaUploadManager to upload the cover image to the server
        MediaUploadManager.uploadFile(file, 'image')
          .then((result) => {
            // Set the playlist manager's cover ID to the uploaded image ID
            this.playlistManager.setCover(result.id);
            console.log('Capa enviada com sucesso!');
            console.log(result.id);
          })
          .catch((error) => {
            console.error('Erro ao enviar a capa:', error); // Log error message
            console.log('Erro ao enviar a capa.'); // Additional error message (might be redundant)
          });
    }

    savePlaylist() {
        const name = document.getElementById('playlist-name').value.trim();
        if (!name) {
            alert('Por favor, insira um nome para a playlist.');
            return;
        }
    
        this.playlistManager.setName(name);
    
        if (!this.playlistManager.validate()) {
            alert('Por favor, adicione itens à playlist e selecione uma capa.');
            return;
        }
    
        // Mapeia os itens da playlist para um JSON
        const playlistItems = this.playlistManager.items.map(item => ({
            id: item.id,
            type: item.type,
            duration: item.duration
        }));
    
        // A capa selecionada
        const coverId = this.playlistManager.coverId;
    
        // Dados a serem enviados para a API
        const playlistData = {
            name: name,
            playlist_Items: playlistItems,
            coverId: coverId
        };
    
        // Se o id for nulo, estamos criando uma nova playlist
        const url = this.playlistManager.id ? `/api/update-playlist/${this.playlistManager.id}` : '/api/save-playlist';
        const method = this.playlistManager.id ? 'PUT' : 'POST'; // PUT para edição, POST para criação
        console.log(url);
        console.log(this.playlistManager);
        // Enviar os dados para a API
        fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(playlistData)
        })
        .then(response => {
            if (!response.ok) throw new Error('Erro ao salvar a playlist');
            return response.json();
        })
        .then(data => {
            if (this.playlistManager.id) {
                alert('Playlist editada com sucesso!');
            } else {
                alert('Playlist salva com sucesso!');
            }
            this.closePopup('save-playlist-popup');
        })
        .catch((error) => {
            console.error('Erro ao salvar playlist:', error);
            alert('Erro ao salvar a playlist. Por favor, tente novamente.');
        });
    }     

    showPopup(popupId) {
        document.getElementById(popupId).style.display = 'block';
    }

    closePopup(popupId) {
        if (!popupId) {
            const popups = document.querySelectorAll('.popup');
            popups.forEach(popup => {
                if (popup.style.display === 'block') {
                    popup.style.display = 'none';
                }
            });
            return;
        }
    
        const popup = document.getElementById(popupId);
        if (popup) {
            popup.style.display = 'none';
        }
    }

    renderPlaylist() {
        const container = document.getElementById('slides');
        container.innerHTML = '';
    
        this.playlistManager.items.forEach((item, index) => {
            const slideElement = this.createSlideElement(item, index);
            slideElement.setAttribute('data-type', item.type);
            slideElement.setAttribute('data-id', item.id);
            slideElement.setAttribute('data-duration', item.duration);
            container.appendChild(slideElement);
        });
    }

    createSlideElement(item, index) {
        const slideWrapper = document.createElement('div');
        slideWrapper.className = `sortable-item`;
        slideWrapper.dataset.index = index;

        const mediaElement = this.createMediaElement(item);
        slideWrapper.appendChild(mediaElement);

        const durationButton = this.createDurationButton(item, index);
        slideWrapper.appendChild(durationButton);

        const deleteButton = this.createDeleteButton(index);
        slideWrapper.appendChild(deleteButton);

        return slideWrapper;
    }

    createMediaElement(item) {
        let mediaElement;
        switch(item.type) {
            case 'image':
                mediaElement = document.createElement('img');
                mediaElement.src = `/images/${item.id}`;
                break;
            case 'video':
                mediaElement = document.createElement('video');
                mediaElement.src = `/videos/${item.id}`;
                mediaElement.controls = true;
                break;
            case 'text':
                // Parse the text slide data
                const textData = JSON.parse(item.id);
                mediaElement = document.createElement('div');
                mediaElement.innerHTML = textData.content;
                mediaElement.className = 'slide-text';
                
                // Apply background if exists
                if (textData.backgroundId) {
                    mediaElement.style.backgroundImage = `url('/images/${textData.backgroundId}')`;
                    mediaElement.style.backgroundSize = 'cover';
                    mediaElement.style.backgroundPosition = 'center';
                    mediaElement.style.backgroundRepeat = 'no-repeat';
                }
                
                // Ensure text is readable over background
                mediaElement.style.color = 'white';
                mediaElement.style.textShadow = '1px 1px 2px black';
                break;
        }
        mediaElement.style.width = '380px';
        mediaElement.style.height = '480px';
        mediaElement.style.display = 'flex';
        mediaElement.style.alignItems = 'center';
        mediaElement.style.justifyContent = 'center';
        mediaElement.style.padding = '20px';
        mediaElement.style.boxSizing = 'border-box';
        return mediaElement;
    }

    createDurationButton(item, index) {
        const durationButton = document.createElement('div');
        durationButton.className = 'time-bubble';
        durationButton.textContent = `${item.duration}s`;
        durationButton.onclick = () => {
            const newDuration = prompt('Duração do slide (em segundos):', item.duration);
            if (newDuration && !isNaN(newDuration)) {
                this.playlistManager.updateItemDuration(index, parseInt(newDuration));
                this.renderPlaylist();
            }
        };
        return durationButton;
    }
    
    createDeleteButton(index) {
        const deleteButton = document.createElement('div'); 
        deleteButton.className = 'delete-button';
        deleteButton.textContent = 'X';
        deleteButton.onclick = () => {
            this.playlistManager.removeItem(index);
            this.renderPlaylist();
        };
        return deleteButton;
    }
    

    getSelectedItemIndex() {
        const selectedSlide = document.querySelector('.slide.selected');
        return selectedSlide ? parseInt(selectedSlide.dataset.index) : -1;
    }

    cancelEdit() {
        if (this.playlistManager.id) {
            this.loadPlaylist(this.playlistManager.id);
        } else {
            this.playlistManager = new PlaylistManager();
            this.renderPlaylist();
        }
    }
    
    async fetchRecentUploads() {
        try {
            const response = await fetch('/recent-uploads');
            if (!response.ok) throw new Error('Falha ao buscar uploads recentes');
            const data = await response.json();
    
            // Log the response to check its format
            console.log('Recent uploads response:', data);
    
            // Ensure recentItems is an array
            const recentItems = data.recentUploads;
            if (!Array.isArray(recentItems)) {
                throw new Error('A resposta não é um array');
            }
    
            this.renderRecentUploads(recentItems);
        } catch (error) {
            console.error('Erro ao buscar uploads recentes:', error);
        }
    }
    
    renderRecentUploads(recentItems) {
        const container = document.getElementById('recent-uploads-container');
        container.innerHTML = '';
    
        // Add a check to handle empty or undefined array
        if (!recentItems || !Array.isArray(recentItems)) {
            console.warn('No recent uploads or invalid data');
            return;
        }
    
        recentItems.forEach(item => {
            // Add null/undefined checks for item properties
            if (!item || !item.type || !item.id) {
                console.warn('Skipping invalid upload item:', item);
                return;
            }
    
            const element = document.createElement('div');
            element.className = 'upload-item';
            
            // Use optional chaining and nullish coalescing for safety
            element.setAttribute('data-type', item.type);
            element.setAttribute('data-id', item.id);
            element.setAttribute('data-token', item.token || '');
            element.setAttribute('data-duration', item.duration || 5);
            element.setAttribute('draggable', 'true');
    
            // Safer media element creation
            let mediaElement;
            if (item.type === 'image') {
                mediaElement = document.createElement('img');
                mediaElement.src = item.src || `/images/${item.id}`;
                mediaElement.alt = `Uploaded Image ${item.id}`;
            } else if (item.type === 'video') {
                mediaElement = document.createElement('video');
                mediaElement.src = item.src || `/videos/${item.id}`;
                mediaElement.controls = true;
            }
    
            if (mediaElement) {
                element.appendChild(mediaElement);
            }
    
            container.appendChild(element);
        });
    }
       

    createUploadElement(upload) {
        const element = document.createElement('div');
        element.className = 'upload-item';
        element.dataset.token = upload.token;
        element.draggable = true;

        const thumbnail = document.createElement('img');
        thumbnail.src = upload.type === 'image' ? `/images/${upload.id}` : '/path/to/video-thumbnail.png';
        thumbnail.alt = upload.name;

        const name = document.createElement('span');
        name.textContent = upload.name;

        element.appendChild(thumbnail);
        element.appendChild(name);

        element.addEventListener('click', () => this.addItemFromUpload(upload));

        return element;
    }

    addItemFromUpload(upload) {
        this.playlistManager.addItem(upload.type, upload.id);
        this.renderPlaylist();
    }

    searchUploads(query) {
        const items = document.querySelectorAll('.upload-item');
        items.forEach(item => {
            const name = item.querySelector('span').textContent.toLowerCase();
            if (name.includes(query.toLowerCase())) {
                item.style.display = 'block';
            } else {
                item.style.display = 'none';
            }
        });
    }

    initializeTinyMCE() {
        tinymce.init({
            selector: '#tinymce-editor',
            plugins: 'link image code',
            toolbar: 'undo redo | formatselect | bold italic | alignleft aligncenter alignright | link image | code',
            height: 300
        });
    }

    selectCover(coverId) {
        this.playlistManager.setCover(coverId);
        // Atualizar a visualização da capa selecionada
        const coverElements = document.querySelectorAll('.cover-option');
        coverElements.forEach(el => {
            el.classList.toggle('selected', el.dataset.id === coverId);
        });
    }
}

class SetupDragAndDrop {
    constructor(recentUploadsId, playlistId, onItemAddedCallback, onOrderChangedCallback, app) {
        // Seletores
        this.recentUploadsContainer = document.getElementById(recentUploadsId);
        this.playlistContainer = document.getElementById(playlistId);

        // Callbacks para integração
        this.onItemAdded = onItemAddedCallback; // Quando um item é adicionado à playlist
        this.onOrderChanged = onOrderChangedCallback; // Quando a ordem na playlist muda

        this.app = app;
        
        this.initDragAndDrop();
    }

    // Configura os contêineres de drag-and-drop
    initDragAndDrop() {
        // Configura o contêiner de uploads recentes
        Sortable.create(this.recentUploadsContainer, {
            group: {
                name: 'shared',
                pull: 'clone', // Permite arrastar cópias dos itens
                put: false, // Impede que itens sejam adicionados de volta aqui
            },
            animation: 150,
            sort: false, // Não permite reordenar os itens aqui
        });

        // Configura o contêiner de playlist
        Sortable.create(this.playlistContainer, {
            group: 'shared',
            animation: 150,
            onAdd: (evt) => this.handleItemAdded(evt),
            onEnd: (evt) => this.handleOrderChanged(evt),
        });
    }

    // Função para manipular a mudança de ordem (handleOrderChanged)
    handleOrderChanged(evt) {
        const oldIndex = evt.oldIndex;
        const newIndex = evt.newIndex;

        if (oldIndex !== newIndex) {
            this.app.playlistManager.updateItemOrder(oldIndex, newIndex);  // Chamando o método da PlaylistManager
        }
    }

    // Função para manipular o item adicionado (handleItemAdded)
    handleItemAdded(evt) {
        const item = evt.item;
        if (item && this.app) {  // Check if app is defined before using it
          const { type, id, duration = 5 } = item.dataset;
          
          const slideElement = this.app.createSlideElement(
            { type, id, duration: parseInt(duration) },
            this.app.playlistManager.items.length
          );
          
          evt.to.replaceChild(slideElement, item);
          
          this.app.playlistManager.addItem(type, id, parseInt(duration));
        }
      }
}

// Inicialização da aplicação
document.addEventListener('DOMContentLoaded', () => {
    const app = new PlaylistEditorApp();

    // Inicializa drag-and-drop
    const dragAndDrop = new SetupDragAndDrop(
        'recent-uploads-container', // ID do contêiner de uploads recentes
        'slides',                  // ID do contêiner da playlist
        (item, sourceContainer, targetContainer) => {
            app.playlistManager.addItemToPlaylist(item); // Adicione o item ao gerenciador de playlist
        },
        (oldIndex, newIndex, container) => {
            app.playlistManager.updateItemOrder(oldIndex, newIndex); // Atualize a ordem na playlist
        },
        app
    );
    

    // Se estiver editando uma playlist existente, carregue-a
    const urlParams = new URLSearchParams(window.location.search);
    const playlistId = urlParams.get('id');
    console.log(playlistId);
    if (playlistId) {
        app.loadPlaylist(playlistId);
    }
});
