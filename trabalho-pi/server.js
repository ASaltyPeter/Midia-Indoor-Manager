import express from 'express';
import connectToDatabase from './db.js';
import router from './src/routes/index.js';
import path from 'path'; // Importar path para servir arquivos estáticos

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware para analisar JSON
app.use(express.json());

// Middleware para servir arquivos estáticos de uploads
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Middleware para servir arquivos estáticos da pasta public
app.use(express.static('public')); 

// Usar as rotas definidas
app.use('/', router);

connectToDatabase()
  .then((connection) => {
    console.log('Conexão com o banco de dados estabelecida.');

    app.listen(PORT, () => {
      console.log(`Servidor rodando na porta ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Falha ao conectar ao banco de dados:', error);
  });
