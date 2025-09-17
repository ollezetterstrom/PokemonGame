class MapManager {
    constructor() {
        this.currentMap = null;
        this.maps = new Map();
        this.playerPosition = { x: 0, y: 0 };
        this.onEncounter = null;
        this.onDialog = null;
    }

    async loadMap(mapId) {
        try {
            const response = await fetch(`/Worldmaps/${mapId}.json`);
            const mapData = await response.json();
            this.maps.set(mapId, mapData);
            return mapData;
        } catch (error) {
            console.error(`Error loading map ${mapId}:`, error);
            return null;
        }
    }

    async switchMap(mapId, startX = 1, startY = 1) {
        if (!this.maps.has(mapId)) {
            await this.loadMap(mapId);
        }
        this.currentMap = this.maps.get(mapId);
        this.playerPosition = { x: startX, y: startY };
        this.renderMap();
    }

    getTileAt(x, y) {
        if (!this.currentMap) return null;
        const groundLayer = this.currentMap.layers.find(l => l.name === 'ground');
        if (!groundLayer || y >= groundLayer.data.length || x >= groundLayer.data[0].length) return null;
        
        const tileId = groundLayer.data[y][x];
        return this.currentMap.tile_types[tileId];
    }

    getObjectAt(x, y) {
        if (!this.currentMap) return null;
        const objectLayer = this.currentMap.layers.find(l => l.name === 'objects');
        if (!objectLayer || y >= objectLayer.data.length || x >= objectLayer.data[0].length) return null;
        
        const objectId = objectLayer.data[y][x];
        return objectId ? this.currentMap.tile_types[objectId] : null;
    }

    canMoveTo(x, y) {
        if (!this.currentMap) return false;
        if (x < 0 || y < 0 || y >= this.currentMap.height || x >= this.currentMap.width) return false;
        
        const tile = this.getTileAt(x, y);
        const object = this.getObjectAt(x, y);
        
        return tile?.walkable && (!object || object.walkable);
    }

    movePlayer(dx, dy) {
        const newX = this.playerPosition.x + dx;
        const newY = this.playerPosition.y + dy;

        if (this.canMoveTo(newX, newY)) {
            this.playerPosition.x = newX;
            this.playerPosition.y = newY;
            this.checkForEncounters();
            return true;
        }
        return false;
    }

    interact() {
        // Check for interactable objects in adjacent tiles
        const directions = [
            { dx: 0, dy: -1 }, // Up
            { dx: 0, dy: 1 },  // Down
            { dx: -1, dy: 0 }, // Left
            { dx: 1, dy: 0 }   // Right
        ];

        for (const dir of directions) {
            const x = this.playerPosition.x + dir.dx;
            const y = this.playerPosition.y + dir.dy;
            
            const object = this.getObjectAt(x, y);
            if (object && object.onInteract === 'showDialog' && this.onDialog) {
                this.onDialog(object.dialogText);
                return true;
            }
        }
        return false;
    }

    checkForEncounters() {
        if (!this.currentMap || !this.onEncounter) return;
        
        const tile = this.getTileAt(this.playerPosition.x, this.playerPosition.y);
        if (!tile) return;

        const encounters = this.currentMap.encounters[tile.name];
        if (!encounters) return;

        // Random encounter check
        if (Math.random() < 0.1) { // 10% chance of encounter when moving
            const roll = Math.random();
            let cumulative = 0;
            
            for (const encounter of encounters) {
                cumulative += encounter.rate;
                if (roll <= cumulative) {
                    const level = Math.floor(
                        Math.random() * (encounter.level.max - encounter.level.min + 1)
                    ) + encounter.level.min;
                    
                    this.onEncounter(encounter.pokemon, level);
                    break;
                }
            }
        }
    }

    renderMap() {
        // This method will be implemented by the game's UI system
        // It should render the current map and player position
    }
}

// Export the MapManager class
export { MapManager };
