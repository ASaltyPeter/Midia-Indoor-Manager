import { Player } from '/js/Player.js';

// Função para atualizar o relógio no rodapé
function updateClock() {
  const footer = document.querySelector('.footer-text');
  const now = new Date();
  footer.textContent = now.toLocaleTimeString(); // Mostra a hora atual
}

setInterval(updateClock, 1000); // Atualiza a cada segundo

// Função para buscar informações do clima
async function fetchWeather() {
  const apiKey = 'e404daaab5f00e3420aa393f997b68e3'; // Your API key
  const city = 'Serra,BR'; // City name and country code (BR for Brazil)

  try {
    const response = await fetch(`https://api.openweathermap.org/data/2.5/forecast?q=${city}&appid=${apiKey}&units=metric`);
    const weatherData = await response.json();
    
    if (response.ok) {
      console.log(weatherData); // Log full weather data for inspection
      console.log(weatherData.list); // Log list of forecast entries

      const weatherSection = document.querySelector('.weather-section');
      weatherSection.innerHTML = ''; // Clear existing content

      // Filter data to get one entry per day (8 intervals per day, so pick the first of each day)
      const dailyForecasts = weatherData.list.filter((entry, index) => index % 8 === 0);

      // Log the number of daily forecasts to check if we have enough data
      console.log('Number of daily forecasts:', dailyForecasts.length);

      // If you have less than 7 forecasts, show all available data
      const daysToShow = Math.min(dailyForecasts.length, 7);
      const selectedForecasts = dailyForecasts.slice(0, daysToShow);

      selectedForecasts.forEach(forecast => {
        const day = new Date(forecast.dt * 1000); // Convert from Unix timestamp
        const dayName = day.toLocaleDateString('pt-BR', { weekday: 'short' }); // Get day name (e.g., "Seg", "Ter")
        const temp = forecast.main.temp.toFixed(1); // Current temperature, rounded to 1 decimal place
        const maxTemp = forecast.main.temp_max.toFixed(1); // Max temperature
        const minTemp = forecast.main.temp_min.toFixed(1); // Min temperature
        const iconCode = forecast.weather[0].icon; // Weather icon code (e.g., "01d", "02n")
        const rainChance = forecast.rain ? forecast.rain['3h'] : 0; // Chance of rain in the last 3 hours, if available

        // Create a card element
        const card = document.createElement('div');
        card.classList.add('weather-card');

        // Add weather icon
        const icon = document.createElement('img');
        icon.src = `https://openweathermap.org/img/wn/${iconCode}@2x.png`;
        icon.classList.add('weather-icon');
        card.appendChild(icon);

        // Add day name
        const dayElement = document.createElement('h4');
        dayElement.textContent = dayName;
        card.appendChild(dayElement);

        // Add current temperature
        const currentTempElement = document.createElement('div');
        currentTempElement.classList.add('current-temp');
        currentTempElement.textContent = `${temp}°C`;
        card.appendChild(currentTempElement);

        // Add max and min temperatures side by side
        const tempRange = document.createElement('div');
        tempRange.classList.add('temp-range');
        tempRange.innerHTML = `<span>Min: ${minTemp}°C</span> <span>Max: ${maxTemp}°C</span>`;
        card.appendChild(tempRange);

        // Add chance of rain
        const rainElement = document.createElement('p');
        rainElement.textContent = `% chuva: ${rainChance}%`;
        rainElement.classList.add('rain-chance');
        card.appendChild(rainElement);

        // Append the card to the weather section
        weatherSection.appendChild(card);
      });
    } else {
      console.error('Weather API error:', weatherData);
    }
  } catch (error) {
    console.error('Error fetching weather:', error);
  }
}

// Fetch the weather data when the script loads
fetchWeather();

// Função para buscar notícias da NewsAPI
async function fetchNews() {
  const apiKey = '733fb0ac330d400c91b7cc139615059b'; // Sua chave real da NewsAPI
  const url = `https://newsapi.org/v2/top-headlines?sources=CNN&apiKey=${apiKey}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Erro HTTP! Status: ${response.status}`);
    }
    const data = await response.json();

    if (data.articles && data.articles.length > 0) {
      const newsSection = document.querySelector('.news-section');
      newsSection.innerHTML = ''; // Limpa o conteúdo existente

      const articlesToShow = data.articles.slice(0, 12);
      articlesToShow.forEach(article => {
        const card = document.createElement('div');
        card.classList.add('news-card');

        if (article.urlToImage) {
          const image = document.createElement('img');
          image.classList.add('news-image');
          image.src = article.urlToImage;
          card.appendChild(image);
        }

        const title = document.createElement('h3');
        title.textContent = article.title;
        card.appendChild(title);

        const description = document.createElement('p');
        description.textContent = article.description || 'Nenhuma descrição disponível';
        card.appendChild(description);

        newsSection.appendChild(card);
      });
    } else {
      console.error('Nenhum artigo de notícias encontrado.');
    }
  } catch (error) {
    console.error('Erro ao buscar notícias:', error);
  }
}

// Chama a função fetchNews quando o script carrega
fetchNews();
setInterval(fetchNews, 300000); // Atualiza as notícias a cada 5 minutos

// Exemplo: Reproduz o vídeo automaticamente ao carregar
window.onload = () => {
    fetchNews();
    fetchWeather();
};


function moveBackToWaiting() {
    window.location.href = `/waiting`;
};

document.addEventListener('DOMContentLoaded', () => {
    const player = new Player()
    const urlParams = new URLSearchParams(window.location.search);
    const playlistId = urlParams.get('id');
    if (playlistId) {
        player.fetchPlaylistData(playlistId);
    }

    const deviceUUID = localStorage.getItem("deviceUUID");

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
                eventSource.close(); // Fecha a conexão SSE
                moveBackToWaiting();
                return;
            }

            if (data.playlist) {
                console.log("Playlist recebida:", data.playlist);
                // Aqui você pode implementar lógica adicional, se necessário
            }
        } catch (error) {
            console.error("Erro ao processar mensagem do servidor:", error);
        }
    };

    eventSource.onerror = (error) => {
        console.error("Erro na conexão SSE:", error);
        moveBackToWaiting(); // Redireciona em caso de erro
        eventSource.close(); // Fecha a conexão SSE
    };
});