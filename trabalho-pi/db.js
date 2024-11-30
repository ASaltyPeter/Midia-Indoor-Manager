import mysql from 'mysql2/promise';

async function connectToDatabase() {
  try {
    const connection = await mysql.createConnection({
      host: '127.0.0.1', // IP do servidor
      user: 'root',      // Nome de usuário
      password: '',      // Senha (substitua pela sua senha)
      database: 'pi4'    // Nome do banco de dados
    });
    return connection;
  } catch (error) {
    console.error('Erro ao conectar ao banco de dados:', error);
    throw error;
  }
}


export default connectToDatabase;
