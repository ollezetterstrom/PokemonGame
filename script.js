// Game Data and Configuration
let POKEDEX = [];
let POKEMON_DATA = { starter: [], wild: [] };

// Load Pokedex data
fetch('/importantpokemoninfo/pokedex.json')
    .then(response => response.json())
    .then(data => {
        POKEDEX = data;
        // Set up starter Pokemon (traditional starters)
        const starterIds = [1, 4, 7]; // Bulbasaur, Charmander, Squirtle
        POKEMON_DATA.starter = starterIds.map(id => {
            const pokemon = POKEDEX.find(p => p.id === id);
            return {
                id: pokemon.id,  // Store the Pokemon's ID
                name: pokemon.name.english,
                type: pokemon.type.map(t => t.toLowerCase()),
                sprite: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemon.id}.png`,  // Use PokeAPI sprites
                baseStats: {
                    hp: pokemon.base.HP,
                    attack: pokemon.base.Attack,
                    defense: pokemon.base.Defense,
                    spAttack: pokemon.base["Sp. Attack"],
                    spDefense: pokemon.base["Sp. Defense"],
                    speed: pokemon.base.Speed
                },
                species: pokemon.species,
                description: pokemon.description,
                evolution: pokemon.evolution
            };
        });

        // Set up wild Pokemon pool (first 151 Pokemon)
        POKEMON_DATA.wild = POKEDEX.filter(p => p.id <= 151).map(pokemon => ({
            id: pokemon.id,  // Store the Pokemon's ID
            name: pokemon.name.english,
            type: pokemon.type.map(t => t.toLowerCase()),
            sprite: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemon.id}.png`,  // Use PokeAPI sprites
            baseStats: {
                hp: pokemon.base.HP,
                attack: pokemon.base.Attack,
                defense: pokemon.base.Defense,
                spAttack: pokemon.base["Sp. Attack"],
                spDefense: pokemon.base["Sp. Defense"],
                speed: pokemon.base.Speed
            },
            species: pokemon.species,
            description: pokemon.description,
            evolution: pokemon.evolution
        }));
    })
    .catch(error => console.error('Error loading Pokedex:', error));

const ENERGY_COSTS = {
    explore: 20,
    train: 15,
    battle: 25
};

// Game State
class GameState {
    constructor() {
        this.player = {
            name: '',
            coins: 100,
            energy: 100,
            maxEnergy: 100,
            dayCount: 1,
            lastLogin: null,
            pokemon: [],
            inventory: { eggs: 0, energyPotions: 0, rareCandies: 0 }
        };
        this.activities = [];
    }

    save() {
        const saveData = {
            player: this.player,
            activities: this.activities
        };
        localStorage.setItem('pokemonGameSave', JSON.stringify(saveData));
    }

    load() {
        const saveData = localStorage.getItem('pokemonGameSave');
        if (saveData) {
            const data = JSON.parse(saveData);
            this.player = { ...this.player, ...data.player };
            this.activities = data.activities || [];
            return true;
        }
        return false;
    }

    reset() {
        localStorage.removeItem('pokemonGameSave');
        this.player = {
            name: '',
            coins: 100,
            energy: 100,
            maxEnergy: 100,
            dayCount: 1,
            lastLogin: null,
            pokemon: [],
            inventory: { eggs: 0, energyPotions: 0, rareCandies: 0 }
        };
        this.activities = [];
    }

    addActivity(message) {
        const timestamp = new Date().toLocaleTimeString();
        this.activities.unshift({ message, timestamp });
        if (this.activities.length > 20) {
            this.activities.pop();
        }
        this.updateActivityLog();
    }

    updateActivityLog() {
        const activityList = document.getElementById('activityList');
        activityList.innerHTML = '';

        if (this.activities.length === 0) {
            activityList.innerHTML = '<div class="activity-item">Start your adventure to see activities here!</div>';
            return;
        }

        this.activities.forEach(activity => {
            const item = document.createElement('div');
            item.className = 'activity-item';
            item.innerHTML = `<strong>${activity.timestamp}</strong> - ${activity.message}`;
            activityList.appendChild(item);
        });
    }

    checkDailyLogin() {
        const now = new Date();
        const today = now.toDateString();

        if (!this.player.lastLogin || this.player.lastLogin !== today) {
            this.player.lastLogin = today;

            if (this.player.dayCount > 1) {
                return true; // Show daily reward
            }
        }
        return false;
    }

    giveDailyReward() {
        const baseCoins = 100;
        const bonusCoins = Math.floor(this.player.dayCount * 10);
        const totalCoins = baseCoins + bonusCoins;

        this.player.energy = Math.min(this.player.energy + 50, this.player.maxEnergy);
        this.player.coins += totalCoins;
        this.player.dayCount += 1;

        // Special rewards every 7 days
        const giveEgg = this.player.dayCount % 7 === 0;
        if (giveEgg) {
            this.player.inventory.eggs += 1;
        }

        this.addActivity(`Daily login reward claimed! +50 energy, +${totalCoins} coins${giveEgg ? ', +1 egg' : ''}`);

        return { coins: totalCoins, egg: giveEgg };
    }
}

// Pokemon Class
class Pokemon {
    constructor(data, level = 1) {
        this.id = data.id;  // Store the Pokemon's ID from the Pokedex
        this.name = data.name;
        this.type = data.type;
        this.sprite = data.sprite;  // This should now be the PokeAPI sprite URL
        this.level = level;
        this.exp = 0;
        this.expToNext = this.calculateExpToNext();
        this.stats = this.calculateStats(data.baseStats);
        this.currentHp = this.stats.hp;
        this.species = data.species;
        this.description = data.description;
        this.evolution = data.evolution;
    }

    calculateStats(baseStats) {
        const calculateStat = (base, level) => Math.floor((2 * base * level / 100) + level + 10);
        const calculateHP = (base, level) => Math.floor((2 * base * level / 100) + level + level + 10);
        
        return {
            hp: calculateHP(baseStats.hp, this.level),
            attack: calculateStat(baseStats.attack, this.level),
            defense: calculateStat(baseStats.defense, this.level),
            spAttack: calculateStat(baseStats.spAttack, this.level),
            spDefense: calculateStat(baseStats.spDefense, this.level),
            speed: calculateStat(baseStats.speed, this.level)
        };
    }

    // Calculate type effectiveness
    static getTypeEffectiveness(attackType, defenderTypes) {
        const typeChart = {
            'normal': { 'rock': 0.5, 'ghost': 0, 'steel': 0.5 },
            'fire': { 'fire': 0.5, 'water': 0.5, 'grass': 2, 'ice': 2, 'bug': 2, 'rock': 0.5, 'dragon': 0.5, 'steel': 2 },
            'water': { 'fire': 2, 'water': 0.5, 'grass': 0.5, 'ground': 2, 'rock': 2, 'dragon': 0.5 },
            'electric': { 'water': 2, 'electric': 0.5, 'grass': 0.5, 'ground': 0, 'flying': 2, 'dragon': 0.5 },
            'grass': { 'fire': 0.5, 'water': 2, 'grass': 0.5, 'poison': 0.5, 'ground': 2, 'flying': 0.5, 'bug': 0.5, 'rock': 2, 'dragon': 0.5, 'steel': 0.5 },
            'ice': { 'fire': 0.5, 'water': 0.5, 'grass': 2, 'ice': 0.5, 'ground': 2, 'flying': 2, 'dragon': 2, 'steel': 0.5 },
            'fighting': { 'normal': 2, 'ice': 2, 'poison': 0.5, 'flying': 0.5, 'psychic': 0.5, 'bug': 0.5, 'rock': 2, 'ghost': 0, 'dark': 2, 'steel': 2, 'fairy': 0.5 },
            'poison': { 'grass': 2, 'poison': 0.5, 'ground': 0.5, 'rock': 0.5, 'ghost': 0.5, 'steel': 0, 'fairy': 2 },
            'ground': { 'fire': 2, 'electric': 2, 'grass': 0.5, 'poison': 2, 'flying': 0, 'bug': 0.5, 'rock': 2, 'steel': 2 },
            'flying': { 'electric': 0.5, 'grass': 2, 'fighting': 2, 'bug': 2, 'rock': 0.5, 'steel': 0.5 },
            'psychic': { 'fighting': 2, 'poison': 2, 'psychic': 0.5, 'dark': 0, 'steel': 0.5 },
            'bug': { 'fire': 0.5, 'grass': 2, 'fighting': 0.5, 'poison': 0.5, 'flying': 0.5, 'psychic': 2, 'ghost': 0.5, 'dark': 2, 'steel': 0.5, 'fairy': 0.5 },
            'rock': { 'fire': 2, 'ice': 2, 'fighting': 0.5, 'ground': 0.5, 'flying': 2, 'bug': 2, 'steel': 0.5 },
            'ghost': { 'normal': 0, 'psychic': 2, 'ghost': 2, 'dark': 0.5 },
            'dragon': { 'dragon': 2, 'steel': 0.5, 'fairy': 0 },
            'dark': { 'fighting': 0.5, 'psychic': 2, 'ghost': 2, 'dark': 0.5, 'fairy': 0.5 },
            'steel': { 'fire': 0.5, 'water': 0.5, 'electric': 0.5, 'ice': 2, 'rock': 2, 'steel': 0.5, 'fairy': 2 },
            'fairy': { 'fire': 0.5, 'fighting': 2, 'poison': 0.5, 'dragon': 2, 'dark': 2, 'steel': 0.5 }
        };

        let effectiveness = 1;
        defenderTypes.forEach(defenderType => {
            const chart = typeChart[attackType.toLowerCase()];
            if (chart && chart[defenderType.toLowerCase()]) {
                effectiveness *= chart[defenderType.toLowerCase()];
            }
        });
        return effectiveness;
    }

    calculateExpToNext() {
        return Math.floor(100 * Math.pow(this.level, 1.2));
    }

    gainExp(amount) {
        this.exp += amount;
        let leveled = false;

        while (this.exp >= this.expToNext && this.level < 100) {
            this.exp -= this.expToNext;
            this.level++;
            this.stats = this.calculateStats({
                hp: 39 + Math.floor(Math.random() * 30),
                attack: 45 + Math.floor(Math.random() * 25),
                defense: 40 + Math.floor(Math.random() * 20)
            });
            this.currentHp = this.stats.hp;
            this.expToNext = this.calculateExpToNext();
            leveled = true;
        }

        return leveled;
    }

    heal() {
        this.currentHp = this.stats.hp;
    }
}

// Game Manager
class GameManager {
    constructor() {
        this.gameState = new GameState();
        this.mapManager = new MapManager();
        this.mapManager.onEncounter = (pokemonName, level) => this.handleWildEncounter(pokemonName, level);
        this.mapManager.onDialog = (text) => this.showDialog(text);
    }

    async startGame(playerName) {
        // Initialize the map system
        await this.mapManager.loadMap('StarterValley');
        await this.mapManager.switchMap('StarterValley', 2, 2);
        this.gameState.player.name = playerName;
        this.gameState.save();
        this.gameState.addActivity(`Welcome, ${playerName}! Your adventure begins.`);
    }

    getPlayerPokemon() {
        return this.gameState.player.pokemon;
    }

    addPokemon(pokemonData, level = 1) {
        const newPokemon = new Pokemon(pokemonData, level);
        this.gameState.player.pokemon.push(newPokemon);
        this.gameState.save();
        this.gameState.addActivity(`You obtained ${newPokemon.name} (${newPokemon.sprite})!`);
    }

    explore() {
        if (this.gameState.player.energy < ENERGY_COSTS.explore) {
            this.gameState.addActivity("Not enough energy to explore.");
            return null;
        }
        this.gameState.player.energy -= ENERGY_COSTS.explore;
        const wildPokemonData = POKEMON_DATA.wild[Math.floor(Math.random() * POKEMON_DATA.wild.length)];
        this.addPokemon(wildPokemonData, Math.floor(Math.random() * 5) + 1);
        this.gameState.save();
        return wildPokemonData;
    }

    train(pokemonIndex) {
        if (this.gameState.player.energy < ENERGY_COSTS.train) {
            this.gameState.addActivity("Not enough energy to train.");
            return false;
        }
        this.gameState.player.energy -= ENERGY_COSTS.train;
        const pokemon = this.gameState.player.pokemon[pokemonIndex];
        if (pokemon) {
            const expGain = Math.floor(Math.random() * 30) + 20;
            const leveled = pokemon.gainExp(expGain);
            this.gameState.save();
            this.gameState.addActivity(`${pokemon.name} trained and gained ${expGain} EXP.${leveled ? " Leveled up!" : ""}`);
            return true;
        }
        return false;
    }

    battle(pokemonIndex) {
        if (this.gameState.player.energy < ENERGY_COSTS.battle) {
            this.gameState.addActivity("Not enough energy to battle.");
            return false;
        }
        this.gameState.player.energy -= ENERGY_COSTS.battle;
        const playerPokemon = this.gameState.player.pokemon[pokemonIndex];
        const wildPokemonData = POKEMON_DATA.wild[Math.floor(Math.random() * POKEMON_DATA.wild.length)];
        const wildPokemon = new Pokemon(wildPokemonData, Math.floor(Math.random() * 5) + 1);

        // Calculate type effectiveness for both Pokemon
        const playerEffectiveness = Pokemon.getTypeEffectiveness(playerPokemon.type[0], wildPokemon.type);
        const wildEffectiveness = Pokemon.getTypeEffectiveness(wildPokemon.type[0], playerPokemon.type);

        // Enhanced battle logic using stats and type effectiveness
        const playerPower = Math.floor(
            (playerPokemon.stats.attack + playerPokemon.stats.spAttack) * playerEffectiveness +
            (playerPokemon.stats.defense + playerPokemon.stats.spDefense) +
            playerPokemon.stats.speed * 0.5
        );

        const wildPower = Math.floor(
            (wildPokemon.stats.attack + wildPokemon.stats.spAttack) * wildEffectiveness +
            (wildPokemon.stats.defense + wildPokemon.stats.spDefense) +
            wildPokemon.stats.speed * 0.5
        );

        let result;
        let effectiveness = '';
        
        if (playerEffectiveness > 1) effectiveness = "It's super effective! ";
        if (playerEffectiveness < 1) effectiveness = "It's not very effective... ";
        if (playerEffectiveness === 0) effectiveness = "It has no effect... ";

        if (playerPower >= wildPower) {
            const baseCoins = 50;
            const levelBonus = Math.floor(wildPokemon.level * 5);
            const effectivenessBonus = Math.floor(playerEffectiveness * 20);
            const coinsWon = baseCoins + levelBonus + effectivenessBonus;
            
            this.gameState.player.coins += coinsWon;
            const expGained = Math.floor(50 * (1 + (wildPokemon.level - playerPokemon.level) * 0.1));
            playerPokemon.gainExp(expGained);
            
            result = `${effectiveness}Victory! ${playerPokemon.name} (Lv.${playerPokemon.level}) defeated ${wildPokemon.name} (Lv.${wildPokemon.level}). Won ${coinsWon} coins and gained ${expGained} EXP.`;
        } else {
            const damage = Math.floor(20 * wildEffectiveness);
            playerPokemon.currentHp = Math.max(0, playerPokemon.currentHp - damage);
            result = `${effectiveness}Defeat! ${playerPokemon.name} lost to ${wildPokemon.name}. Lost ${damage} HP!`;
        }
        this.gameState.save();
        this.gameState.addActivity(result);
        return result;
    }
}

document.addEventListener('DOMContentLoaded', function() {
  // DOM elements
  const loginBtn = document.getElementById('loginBtn');
  const usernameInput = document.getElementById('usernameInput');
  const loginScreen = document.getElementById('loginScreen');
  const gameScreen = document.getElementById('gameScreen');
  
  // Import map styles
  const mapStyles = document.createElement('link');
  mapStyles.rel = 'stylesheet';
  mapStyles.href = 'css/map.css';
  document.head.appendChild(mapStyles);
  const trainerName = document.getElementById('trainerName');
  const energy = document.getElementById('energy');
  const coins = document.getElementById('coins');
  const dayCount = document.getElementById('dayCount');
  const exploreBtn = document.getElementById('exploreBtn');
  const trainBtn = document.getElementById('trainBtn');
  const battleBtn = document.getElementById('battleBtn');
  const shopBtn = document.getElementById('shopBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const pokemonList = document.getElementById('pokemonList');
  const activityList = document.getElementById('activityList');
  const dailyReward = document.getElementById('dailyReward');
  const claimRewardBtn = document.getElementById('claimRewardBtn');
  const coinReward = document.getElementById('coinReward');
  const specialReward = document.getElementById('specialReward');
  const shopModal = document.getElementById('shopModal');
  const closeShop = document.getElementById('closeShop');

  // Game manager
  const gameManager = new GameManager();

  // Helper: update player info UI
  function updatePlayerUI() {
    trainerName.textContent = gameManager.gameState.player.name || 'Trainer';
    energy.textContent = gameManager.gameState.player.energy;
    coins.textContent = gameManager.gameState.player.coins;
    dayCount.textContent = gameManager.gameState.player.dayCount;
  }

  // Helper: render map
  function renderMap() {
    const mapContainer = document.getElementById('mapContainer');
    const mapPlayer = document.getElementById('mapPlayer');
    const currentMap = gameManager.mapManager.currentMap;
    
    if (!currentMap) return;

    // Set up grid
    mapContainer.style.gridTemplateColumns = `repeat(${currentMap.width}, ${currentMap.tile_size}px)`;
    mapContainer.innerHTML = '';

    // Render ground layer
    const groundLayer = currentMap.layers.find(l => l.name === 'ground');
    const objectLayer = currentMap.layers.find(l => l.name === 'objects');

    for (let y = 0; y < currentMap.height; y++) {
      for (let x = 0; x < currentMap.width; x++) {
        const tile = document.createElement('div');
        tile.className = 'map-tile';
        
        // Ground tile
        const groundTileId = groundLayer.data[y][x];
        const groundTileType = currentMap.tile_types[groundTileId];
        tile.classList.add(`tile-${groundTileType.name.toLowerCase()}`);
        
        // Object tile
        const objectTileId = objectLayer.data[y][x];
        if (objectTileId) {
          const objectTileType = currentMap.tile_types[objectTileId];
          tile.classList.add(`tile-${objectTileType.name.toLowerCase()}`);
        }
        
        mapContainer.appendChild(tile);
      }
    }

    // Update player position
    const playerPos = gameManager.mapManager.playerPosition;
    mapPlayer.style.transform = `translate(${playerPos.x * currentMap.tile_size}px, ${playerPos.y * currentMap.tile_size}px)`;
  }

  // Helper: show dialog
  function showDialog(text) {
    const existingDialog = document.querySelector('.map-dialog');
    if (existingDialog) existingDialog.remove();

    const dialog = document.createElement('div');
    dialog.className = 'map-dialog';
    dialog.textContent = text;
    document.body.appendChild(dialog);

    setTimeout(() => dialog.remove(), 3000);
  }

  // Helper: render Pokémon team
  function renderPokemonTeam() {
    pokemonList.innerHTML = '';
    const team = gameManager.getPlayerPokemon();
    if (!team.length) {
      pokemonList.innerHTML = '<div class="no-pokemon">No Pokémon yet. Explore to find some!</div>';
      return;
    }
    team.forEach((poke, idx) => {
      const card = document.createElement('div');
      card.className = 'pokemon-card';
      // Create the sprite URL using the Pokemon's ID
      const spriteUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${poke.id}.png`;
      
      card.innerHTML = `
        <div class="pokemon-image">
          <img 
            src="${spriteUrl}" 
            alt="${poke.name}" 
            class="sprite-img"
            onerror="this.style.opacity='0.5'; this.style.filter='grayscale(100%)'"
          >
        </div>
        <div class="pokemon-info">
          <div class="pokemon-name">${poke.name}</div>
          <div class="pokemon-level">Lv. ${poke.level}</div>
          <div class="pokemon-hp">
            <div class="hp-label">HP: ${poke.currentHp}/${poke.stats.hp}</div>
            <div class="hp-bar">
              <div class="hp-fill" style="width: ${(poke.currentHp / poke.stats.hp) * 100}%"></div>
            </div>
          </div>
          <div class="pokemon-types">
            ${poke.type.map(t => `<span class="type-badge type-${t.toLowerCase()}">${t}</span>`).join('')}
          </div>
        </div>
        <div class="pokemon-actions">
          <button class="btn btn-small" data-train="${idx}">Train</button>
          <button class="btn btn-small" data-battle="${idx}">Battle</button>
        </div>
      `;
      pokemonList.appendChild(card);
    });
  }

  // Helper: update activity log
  function updateActivityLog() {
    activityList.innerHTML = '';
    if (!gameManager.gameState.activities.length) {
      activityList.innerHTML = '<div class="activity-item">Start your adventure to see activities here!</div>';
      return;
    }
    gameManager.gameState.activities.forEach(activity => {
      const item = document.createElement('div');
      item.className = 'activity-item';
      item.innerHTML = `<strong>${activity.timestamp}</strong> - ${activity.message}`;
      activityList.appendChild(item);
    });
  }

  // Helper: show daily reward if needed
  function checkAndShowDailyReward() {
    if (gameManager.gameState.checkDailyLogin()) {
      dailyReward.classList.remove('hidden');
      coinReward.textContent = 100 + Math.floor(gameManager.gameState.player.dayCount * 10);
      if ((gameManager.gameState.player.dayCount + 1) % 7 === 0) {
        specialReward.classList.remove('hidden');
      } else {
        specialReward.classList.add('hidden');
      }
    } else {
      dailyReward.classList.add('hidden');
    }
  }

  // Login button event
  loginBtn.addEventListener('click', function() {
    const username = usernameInput.value.trim();
    if (!username) {
      usernameInput.classList.add('input-error');
      usernameInput.focus();
      return;
    }
    usernameInput.classList.remove('input-error');
    gameManager.startGame(username);
    updatePlayerUI();
    renderPokemonTeam();
    updateActivityLog();
    loginScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    checkAndShowDailyReward();
  });

  // Logout button event
  logoutBtn.addEventListener('click', function() {
    gameManager.gameState.reset();
    loginScreen.classList.remove('hidden');
    gameScreen.classList.add('hidden');
    usernameInput.value = '';
  });

    // Explore button event
    exploreBtn.addEventListener('click', function() {
        const result = gameManager.explore();
        updatePlayerUI();
        renderPokemonTeam();
        updateActivityLog();
        if (result) {
            alert(`You found a wild ${result.name}!`);
        }
    });

    // Train button event (trains selected Pokémon)
    trainBtn.addEventListener('click', function() {
        if (gameManager.getPlayerPokemon().length === 0) {
            alert('No Pokémon to train! Explore to find some first.');
            return;
        }
        gameManager.train(0);
        updatePlayerUI();
        renderPokemonTeam();
        updateActivityLog();
    });

    // Battle button event (battles with selected Pokémon)
    battleBtn.addEventListener('click', function() {
        if (gameManager.getPlayerPokemon().length === 0) {
            alert('No Pokémon to battle with! Explore to find some first.');
            return;
        }
        const result = gameManager.battle(0);
        updatePlayerUI();
        renderPokemonTeam();
        updateActivityLog();
        if (result) {
            alert(result);
        }
    });

    // Shop button event
    shopBtn.addEventListener('click', function() {
        shopModal.classList.remove('hidden');
    });

    // Close shop button event
    closeShop.addEventListener('click', function() {
        shopModal.classList.add('hidden');
    });

    // Daily reward claim event
    claimRewardBtn.addEventListener('click', function() {
        const reward = gameManager.gameState.giveDailyReward();
        updatePlayerUI();
        updateActivityLog();
        dailyReward.classList.add('hidden');
        if (reward.egg) {
            specialReward.classList.add('hidden');
        }
    });

    // Pokemon card train/battle buttons
    pokemonList.addEventListener('click', function(e) {
        const trainBtn = e.target.closest('[data-train]');
        const battleBtn = e.target.closest('[data-battle]');
        
        if (trainBtn) {
            const idx = parseInt(trainBtn.getAttribute('data-train'));
            gameManager.train(idx);
            updatePlayerUI();
            renderPokemonTeam();
            updateActivityLog();
        } else if (battleBtn) {
            const idx = parseInt(battleBtn.getAttribute('data-battle'));
            const result = gameManager.battle(idx);
            updatePlayerUI();
            renderPokemonTeam();
            updateActivityLog();
            if (result) {
                alert(result);
            }
        }
    });

    // Shop item purchase buttons
    document.querySelector('.shop-items').addEventListener('click', function(e) {
        const buyButton = e.target.closest('.btn-small');
        if (!buyButton) return;

        const cost = parseInt(buyButton.getAttribute('data-cost'));
        const item = buyButton.getAttribute('data-item');
        
        if (gameManager.gameState.player.coins < cost) {
            alert('Not enough coins!');
            return;
        }

        gameManager.gameState.player.coins -= cost;
        
        switch(item) {
            case 'egg':
                gameManager.gameState.player.inventory.eggs += 1;
                gameManager.gameState.addActivity('Bought a Pokemon Egg!');
                break;
            case 'energy':
                gameManager.gameState.player.energy = Math.min(
                    gameManager.gameState.player.maxEnergy,
                    gameManager.gameState.player.energy + 50
                );
                gameManager.gameState.addActivity('Used Energy Potion! +50 Energy');
                break;
            case 'candy':
                if (gameManager.getPlayerPokemon().length > 0) {
                    const pokemon = gameManager.getPlayerPokemon()[0];
                    pokemon.gainExp(100);
                    gameManager.gameState.addActivity(`Used Rare Candy on ${pokemon.name}!`);
                } else {
                    alert('No Pokemon to use Rare Candy on!');
                    gameManager.gameState.player.coins += cost; // Refund
                    return;
                }
                break;
        }
        
        gameManager.gameState.save();
        updatePlayerUI();
        renderPokemonTeam();
        updateActivityLog();
    });

    // Load saved game if exists
    if (gameManager.gameState.load() && gameManager.gameState.player.name) {
        updatePlayerUI();
        renderPokemonTeam();
        updateActivityLog();
        loginScreen.classList.add('hidden');
        gameScreen.classList.remove('hidden');
        checkAndShowDailyReward();
    }

}); // <-- Closing bracket for DOMContentLoaded