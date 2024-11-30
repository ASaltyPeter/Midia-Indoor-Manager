import express from 'express';
import { Router } from 'express';
import path from 'path';
import multer from 'multer';
import connectToDatabase from '../../db.js';

const router = Router();
const __dirname = path.resolve();
const playQueue = [];

// Configuração do multer para manipulação de arquivos (armazenamento na memória)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// 'tinymce' - Acessa o editor TinyMCE via URL
router.use('/tinymce', express.static(path.join(__dirname, 'tinymce')));

// Rota para a Landing Page
router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '/src/views/Landing-Page.html'));
});

// Rota para a página de gerenciamento
router.get('/manage', (req, res) => {
    res.sendFile(path.join(__dirname, '/src/views/Manager.html'));
});

router.get('/waiting', (req, res) => {
    res.sendFile(path.join(__dirname, '/src/views/Waiting-Room.html'));
});


// Rota para a seleção de playlists
router.get('/selector', (req, res) => {
    res.sendFile(path.join(__dirname, '/src/views/Playlist-Selector.html'));
});

router.get('/display', (req, res) => {
    res.sendFile(path.join(__dirname, '/src/views/Main-Display.html'));
});

// Rota para o player de playlist
router.get('/player', (req, res) => {
    res.sendFile(path.join(__dirname, '/src/views/Player.html'));
});

// Rota para a escolha de playlists
router.get('/playlists', (req, res) => {
    res.sendFile(path.join(__dirname, '/src/views/Choose-Playlists.html'));
});

// Rota para a criação de playlists
router.get('/create', (req, res) => {
    res.sendFile(path.join(__dirname, '/src/views/Playlist-Editor.html'));
});

// Rota para edição de playlists (com ID de playlist na query)
router.get('/edit', (req, res) => {
    const playlistId = req.query.id;
    res.sendFile(path.join(__dirname, '/src/views/Playlist-Editor.html'));
});

// Rota para buscar a playlist e seus itens para edição
router.get('/api/edit/:id', async (req, res) => {
    const { id } = req.params;
    const connection = await connectToDatabase();
    
    try {
      const [rows] = await connection.execute('SELECT * FROM playlists WHERE id = ?', [id]);
  
      if (!rows.length) {
        return res.status(404).json({ error: 'Playlist não encontrada' });
      }
  
      const { id: playlistId, name, cover_id: coverId, playlist_Items } = rows[0];
  
      let items = [];
  
      // Se playlist_Items já for um objeto ou array, use diretamente
      if (typeof playlist_Items === 'object') {
        items = playlist_Items; // Não precisa fazer JSON.parse()
      } else if (typeof playlist_Items === 'string') {
        // Se for uma string (JSON), faça o parse
        try {
          items = JSON.parse(playlist_Items);
        } catch (error) {
          console.error("Erro ao parsear playlist_Items:", error);
          return res.status(500).json({ error: 'Erro ao processar os itens da playlist' });
        }
      }
  
      const playlist = {
        id: playlistId,
        name,
        cover_id: coverId,
        items,
      };
  
      res.json({ playlist });
    } catch (error) {
      console.error("Erro ao buscar playlist para edição:", error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    } finally {
      connection.end();
    }
});

// Rota para listar playlists com paginação
router.get('/api/playlists', async (req, res) => {
    const offset = Number.parseInt(req.query.offset, 10) || 0;
    const limit = Number.parseInt(req.query.limit, 10) || 9;

    try {
        const connection = await connectToDatabase();

        // Consulta para buscar as playlists com a paginação
        const [playlists] = await connection.execute(
            `SELECT id, name, cover_id AS coverId
             FROM playlists
             ORDER BY uploadDate DESC
             LIMIT ${offset}, ${limit}`
        );

        res.json({ playlists });
        connection.end(); // Fecha a conexão com o banco de dados
    } catch (error) {
        console.error("Erro ao buscar playlists:", error);
        res.status(500).json({ message: "Erro ao buscar playlists" });
    }
});

// Rota para buscar uma imagem específica pelo ID
router.get('/api/images/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const connection = await connectToDatabase();

        // Query para obter o conteúdo da imagem
        const [imageRows] = await connection.execute(
            `SELECT content FROM images WHERE id = ${id}`
        );

        if (imageRows.length === 0) {
            return res.status(404).json({ message: 'Imagem não encontrada' });
        }

        const image = imageRows[0].content;

        // Definindo o cabeçalho para exibir a imagem
        res.setHeader('Content-Type', 'images/png'); // Ajuste o tipo MIME conforme necessário
        res.send(image);

        connection.end(); // Fecha a conexão com o banco de dados
    } catch (error) {
        console.error("Erro ao buscar imagem:", error);
        res.status(500).json({ message: "Erro ao buscar imagem" });
    }
});

router.get('/recent-uploads', async (req, res) => {
    try {
        const connection = await connectToDatabase();
        const [rows] = await connection.execute(`
            SELECT id, 'image' AS type, uploadDate FROM images
            UNION
            SELECT id, 'video' AS type, uploadDate FROM videos
            ORDER BY uploadDate DESC
            LIMIT 20
        `);

        const uploads = rows.map(upload => ({
            id: upload.id,
            type: upload.type,
            token: `${upload.type}-${upload.id}`,
            src: `/${upload.type}s/${upload.id}`,
        }));

        res.json({ recentUploads: uploads });
    } catch (error) {
        console.error('Erro ao carregar uploads recentes:', error);
        res.status(500).json({ message: 'Erro ao buscar uploads recentes' });
    }
});

// Rota para upload de imagem
const uploadImage = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Nenhum arquivo enviado' });
        }

        const imageBuffer = req.file.buffer; // Obtendo o conteúdo da imagem
        const uploadDate = new Date(); // Data de upload

        const connection = await connectToDatabase();
        const [result] = await connection.execute(
            'INSERT INTO images (content, uploadDate) VALUES (?, ?)',
            [imageBuffer, uploadDate]
        );

        const imageUrl = `/images/${result.insertId}`; // URL da imagem

        res.status(200).json({
            success: true,
            file: {
                url: imageUrl,
                id: result.insertId,
                type: 'image'
            }
        });

        connection.end(); // Fecha a conexão com o banco de dados
    } catch (err) {
        console.error('Erro ao salvar imagem:', err);
        res.status(500).json({ message: 'Erro ao salvar a imagem' });
    }
};

router.post('/api/upload-image', upload.single('image'), uploadImage);

// Rota para upload de vídeo
router.post('/api/upload-video', upload.single('video'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'Nenhum vídeo enviado' });
    }

    try {
        const content = req.file.buffer;
        const uploadDate = new Date();

        const connection = await connectToDatabase();
        const [result] = await connection.execute(
            'INSERT INTO videos (content, uploadDate) VALUES (?, ?)',
            [content, uploadDate]
        );

        const videoUrl = `/videos/${result.insertId}`;

        res.status(200).json({
            success: true,
            file: {
                url: videoUrl,
                id: result.insertId,
                type: 'video'
            }
        });

        connection.end();
    } catch (error) {
        console.error('Erro ao salvar vídeo:', error);
        res.status(500).json({ message: 'Erro ao salvar o vídeo' });
    }
});

// Rota para upload de texto
router.post('/upload-text', async (req, res) => {
    const { content, backgroundId } = req.body;

    if (!content) {
        return res.status(400).json({ message: 'Text content required' });
    }

    try {
        const connection = await connectToDatabase();
        const [result] = await connection.execute(
            'INSERT INTO text (content, has_background, image_id) VALUES (?, ?, ?)',
            [content, backgroundId ? 1 : 0, backgroundId || null]
        );

        res.status(200).json({
            success: true,
            file: { 
                id: result.insertId, 
                type: 'text'
            }
        });

        connection.end();
    } catch (error) {
        console.error('Text save error:', error);
        res.status(500).json({ success: false, message: 'Text save failed' });
    }
});

// Rota para buscar uma imagem pelo ID
router.get('/images/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const connection = await connectToDatabase();
        const [rows] = await connection.execute('SELECT content FROM images WHERE id = ?', [id]);

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Imagem não encontrada' });
        }

        const image = rows[0].content;

        res.set('Content-Type', 'image/jpeg'); // Ou 'image/png', se for o caso
        res.send(image);

        connection.end(); // Fecha a conexão com o banco de dados
    } catch (error) {
        console.error('Erro ao buscar imagem:', error);
        res.status(500).json({ message: 'Erro ao buscar a imagem' });
    }
});

// Rota para buscar um vídeo pelo ID
router.get('/videos/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const connection = await connectToDatabase();
        const [rows] = await connection.execute('SELECT content FROM videos WHERE id = ?', [id]);

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Vídeo não encontrado' });
        }

        const video = rows[0].content;

        res.setHeader('Content-Type', 'video/mp4');
        res.send(video);

        connection.end(); // Fecha a conexão com o banco de dados
    } catch (error) {
        console.error('Erro ao recuperar o vídeo:', error);
        res.status(500).json({ message: 'Erro ao carregar o vídeo' });
    }
});

router.get('/text/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const connection = await connectToDatabase();

        // Busca o texto pelo ID
        const [rows] = await connection.execute('SELECT * FROM text WHERE id = ?', [id]);

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Texto não encontrado' });
        }

        const textData = rows[0];


        const result = textData;
        

        res.status(200).json(result); // Retorna o texto e, se existir, o background

        connection.end();
    } catch (error) {
        console.error('Erro ao buscar texto:', error);
        res.status(500).json({ message: 'Erro ao buscar texto' });
    }
});

router.post('/api/save-playlist', async (req, res) => {
    console.log('Dados recebidos:', req.body);
    const { name, playlist_Items, coverId } = req.body;

    // Validações
    if (!name || typeof name !== 'string' || name.trim() === '') {
        return res.status(400).json({ success: false, message: 'Nome da playlist é obrigatório!' });
    }

    if (!Array.isArray(playlist_Items) || playlist_Items.length === 0) {
        return res.status(400).json({ success: false, message: 'Os itens da playlist são obrigatórios!' });
    }

    // Verifica se todos os itens possuem a estrutura correta
    const hasInvalidItems = playlist_Items.some(item => !item.id || !item.type || !item.duration);
    if (hasInvalidItems) {
        return res.status(400).json({ success: false, message: 'Todos os itens precisam ter id, type e duration válidos!' });
    }

    if (!coverId) {
        return res.status(400).json({ success: false, message: 'Por favor, selecione uma capa para a playlist.' });
    }

    let connection;
    try {
        connection = await connectToDatabase();
        await connection.beginTransaction();

        const query = `
            INSERT INTO playlists (name, playlist_Items, cover_id, uploadDate)
            VALUES (?, ?, ?, NOW())
        `;

        const [result] = await connection.execute(query, [name, JSON.stringify(playlist_Items), coverId]);
        
        await connection.commit();

        res.status(201).json({ 
            success: true, 
            message: 'Playlist salva com sucesso!',
            playlistId: result.insertId
        });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Erro ao salvar a playlist:', error);
        res.status(500).json({ success: false, message: 'Erro ao salvar a playlist' });
    } finally {
        if (connection) connection.end();
    }
});

router.put('/api/update-playlist/:id', async (req, res) => {
    console.log('Dados recebidos para atualização:', req.body);
    const { id } = req.params;
    const { name, playlist_Items, coverId } = req.body;

    // Validações
    if (!name || typeof name !== 'string' || name.trim() === '') {
        return res.status(400).json({ success: false, message: 'Nome da playlist é obrigatório!' });
    }

    if (!Array.isArray(playlist_Items) || playlist_Items.length === 0) {
        return res.status(400).json({ success: false, message: 'Os itens da playlist são obrigatórios!' });
    }

    // Verifica se todos os itens possuem a estrutura correta
    const hasInvalidItems = playlist_Items.some(item => !item.id || !item.type || !item.duration);
    if (hasInvalidItems) {
        return res.status(400).json({ success: false, message: 'Todos os itens precisam ter id, type e duration válidos!' });
    }

    if (!coverId) {
        return res.status(400).json({ success: false, message: 'Por favor, selecione uma capa para a playlist.' });
    }

    let connection;
    try {
        connection = await connectToDatabase();
        await connection.beginTransaction();

        const query = `
            UPDATE playlists 
            SET name = ?, playlist_Items = ?, cover_id = ?, updated_at = NOW()
            WHERE id = ?
        `;

        const [result] = await connection.execute(query, [name, JSON.stringify(playlist_Items), coverId, id]);
        
        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: 'Playlist não encontrada.' });
        }

        await connection.commit();

        res.status(200).json({ 
            success: true, 
            message: 'Playlist atualizada com sucesso!',
            playlistId: id
        });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Erro ao atualizar a playlist:', error);
        res.status(500).json({ success: false, message: 'Erro ao atualizar a playlist' });
    } finally {
        if (connection) connection.end();
    }
});

router.get('/api/list-devices', async (req, res) => {
    try {
        // Estabelece conexão com o banco
        const connection = await connectToDatabase();

        // Consulta todos os dispositivos
        const [devices] = await connection.execute('SELECT uuid, name FROM devices ORDER BY created_at DESC');

        // Fecha a conexão
        await connection.end();

        res.json({ success: true, devices });
    } catch (error) {
        console.error('Erro ao listar dispositivos:', error);
        res.status(500).json({ success: false, message: 'Erro ao listar dispositivos.' });
    }
});

router.post('/api/update-device', async (req, res) => {
    const { uuid, name } = req.body;

    if (!uuid || !name) {
        return res.status(400).json({ success: false, message: 'UUID e nome são obrigatórios.' });
    }

    try {
        // Estabelece conexão com o banco
        const connection = await connectToDatabase();

        // Atualiza o nome do dispositivo
        const [result] = await connection.execute('UPDATE devices SET name = ? WHERE uuid = ?', [name, uuid]);

        // Fecha a conexão
        await connection.end();

        if (result.affectedRows > 0) {
            res.json({ success: true, message: 'Nome do dispositivo atualizado.' });
        } else {
            res.status(404).json({ success: false, message: 'Dispositivo não encontrado.' });
        }
    } catch (error) {
        console.error('Erro ao atualizar o nome do dispositivo:', error);
        res.status(500).json({ success: false, message: 'Erro ao atualizar o dispositivo.' });
    }
});

router.post('/api/remove-device', async (req, res) => {
    const { uuid } = req.body;

    if (!uuid) {
        return res.status(400).json({ success: false, message: 'UUID é obrigatório.' });
    }

    try {
        // Estabelece conexão com o banco
        const connection = await connectToDatabase();

        // Remove o dispositivo
        const [result] = await connection.execute('DELETE FROM devices WHERE uuid = ?', [uuid]);

        // Fecha a conexão
        await connection.end();

        if (result.affectedRows > 0) {
            res.json({ success: true, message: 'Dispositivo removido com sucesso.' });
        } else {
            res.status(404).json({ success: false, message: 'Dispositivo não encontrado.' });
        }
    } catch (error) {
        console.error('Erro ao remover o dispositivo:', error);
        res.status(500).json({ success: false, message: 'Erro ao remover o dispositivo.' });
    }
});


router.post('/api/registrar-uuid', async (req, res) => {
    const { deviceUUID } = req.body;
  
    if (!deviceUUID) {
      return res.status(400).json({ error: 'UUID não fornecido.' });
    }
  
    try {
      const connection = await connectToDatabase();
  
      // Verifica se o UUID já existe no banco
      const [rows] = await connection.execute(
        'SELECT * FROM devices WHERE uuid = ?',
        [deviceUUID]
      );
  
      if (rows.length > 0) {
        // Se o UUID já existe, retornamos um erro específico
        return res.status(400).json({ error: 'UUID já existe' });
      }
  
      // Se o UUID não existe, registramos ele no banco
      const [result] = await connection.execute(
        'INSERT INTO devices (uuid, name, last_active) VALUES (?, ?, NOW())',
        [deviceUUID, deviceUUID.slice(0, 5)] // Usando os 5 primeiros dígitos do UUID como nome
      );
  
      res.json({ success: true });
  
      connection.end();
    } catch (error) {
      console.error('Erro ao registrar UUID:', error);
      res.status(500).json({ error: 'Erro no servidor.' });
    }
});

router.post('/api/check-devices', async (req, res) => {
    const { deviceUUID } = req.body;
  
    if (!deviceUUID) {
      return res.status(400).json({ error: 'UUID não fornecido.' });
    }
  
    try {
      const connection = await connectToDatabase();
  
      // Verifica se o dispositivo está registrado no banco de dados
      const [rows] = await connection.execute(
        'SELECT * FROM devices WHERE uuid = ?',
        [deviceUUID]
      );
  
      if (rows.length === 0) {
        return res.status(404).json({ error: 'Dispositivo não encontrado.' });
      }
  
      const device = rows[0];
  
      // Verifica o tempo de inatividade
      const lastActive = new Date(device.last_active);
      const currentTime = new Date();
      const timeDiff = currentTime - lastActive;
  
      // Considera um dispositivo ativo se ele foi ativo nos últimos 5 minutos (300000ms)
      const isActive = timeDiff < 5 * 60 * 1000;
  
      // Atualiza o campo 'last_active' a cada vez que o dispositivo pinga
      if (isActive) {
        await connection.execute(
          'UPDATE devices SET last_active = NOW() WHERE uuid = ?',
          [deviceUUID]
        );
      }
  
      res.json({ active: isActive });
  
      connection.end();
    } catch (error) {
      console.error('Erro ao verificar o dispositivo:', error);
      res.status(500).json({ error: 'Erro no servidor.' });
    }
});
  
router.post('/api/start-player', (req, res) => {
    const { deviceUUID, playlistID } = req.body;
  
    if (!deviceUUID || !playlistID) {
      return res.status(400).json({ error: 'UUID e PlaylistID são necessários' });
    }
  
    // Adicionar à fila de reprodução
    playQueue.push({ 
      deviceUUID, 
      playlistID,
      timestamp: new Date() 
    });
  
    return res.status(200).json({ 
      message: 'Reprodução solicitada com sucesso',
      queue: playQueue // Retornar fila atual para referência
    });
}); 

// Servidor (Rota de Waiting)
router.get('/api/waiting', (req, res) => {
    const deviceUUID = req.query.uuid;

    if (!deviceUUID) {
        return res.status(400).json({ error: 'UUID do dispositivo não fornecido' });
    }

    // Configurar cabeçalhos para Server-Sent Events
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-open'
    });

    // Função para verificar e enviar playlists pendentes
    const checkPlaylist = () => {
        // Encontrar playlist para o dispositivo específico
        const pendingPlaylists = playQueue.filter(
        item => item.deviceUUID === deviceUUID
        );

        if (pendingPlaylists.length > 0) {
        // Enviar primeira playlist pendente
        res.write(`data: ${JSON.stringify(pendingPlaylists[0])}\n\n`);
        } else {
            // Enviar status de "UUID removido"
            res.write(`data: ${JSON.stringify({ removed: true })}\n\n`);
        }
    };

    // Verificar playlist imediatamente e a cada intervalo
    checkPlaylist();
    const intervalId = setInterval(checkPlaylist, 10000);

    // Limpar recursos quando a conexão for fechada
    req.on('close', () => {
        clearInterval(intervalId);
    });
});

router.post('/api/cancel-playback', (req, res) => {
    const { deviceUUID, playlistID } = req.body;
  
    // Remover item específico da fila
    const index = playQueue.findIndex(
      item => item.deviceUUID === deviceUUID && item.playlistID === playlistID
    );
  
    if (index !== -1) {
      playQueue.splice(index, 1);
      return res.status(200).json({ 
        message: 'Reprodução cancelada',
        queue: playQueue 
      });
    }
  
    return res.status(404).json({ 
      message: 'Reprodução não encontrada',
      queue: playQueue 
    });
});

router.get('/api/active-playbacks', (req, res) => {
    try {
      // Retorna todas as reproduções ativas
      return res.status(200).json({
        activePlaybacks: playQueue.map(playback => ({
          deviceUUID: playback.deviceUUID,
          playlistID: playback.playlistID,
          timestamp: playback.timestamp
        }))
      });
    } catch (error) {
      console.error('Erro ao recuperar reproduções ativas:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
})

export default router;
