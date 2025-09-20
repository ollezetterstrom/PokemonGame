
class StardustManager {
    constructor(mapManager, gameState) {
        this.mapManager = mapManager;
        this.gameState = gameState;
        this.stardustTileId = 6; // The ID for the Stardust tile
        this.lastPlaced = null; // Timestamp of when the stardust was last placed
    }

    // Place the stardust crystal at a random, walkable location
    placeStardust() {
        const now = new Date();
        // Check if stardust has been placed in the last 24 hours
        if (this.lastPlaced && (now - this.lastPlaced) < 24 * 60 * 60 * 1000) {
            return; // Don't place a new one yet
        }

        const walkableTiles = this.getWalkableTiles();
        if (walkableTiles.length === 0) return;

        // Remove any existing stardust
        this.removeStardust();

        const randomIndex = Math.floor(Math.random() * walkableTiles.length);
        const { x, y } = walkableTiles[randomIndex];

        // Update the object layer with the new stardust
        this.mapManager.currentMap.layers.find(l => l.name === 'objects').data[y][x] = this.stardustTileId;
        this.lastPlaced = now;
        this.gameState.save(); // Save the new stardust location

        console.log(`Stardust placed at (${x}, ${y})`);
    }

    // Find all walkable tiles on the map
    getWalkableTiles() {
        const walkable = [];
        const groundLayer = this.mapManager.currentMap.layers.find(l => l.name === 'ground');
        const objectLayer = this.mapManager.currentMap.layers.find(l => l.name === 'objects');

        for (let y = 0; y < this.mapManager.currentMap.height; y++) {
            for (let x = 0; x < this.mapManager.currentMap.width; x++) {
                if (groundLayer.data[y][x] !== 1 && objectLayer.data[y][x] === 0) { // Not stone and no object
                    walkable.push({ x, y });
                }
            }
        }
        return walkable;
    }

    // Remove any existing stardust from the map
    removeStardust() {
        const objectLayer = this.mapManager.currentMap.layers.find(l => l.name === 'objects');
        for (let y = 0; y < this.mapManager.currentMap.height; y++) {
            for (let x = 0; x < this.mapManager.currentMap.width; x++) {
                if (objectLayer.data[y][x] === this.stardustTileId) {
                    objectLayer.data[y][x] = 0; // Remove stardust
                }
            }
        }
    }

    // Handle interaction with a stardust crystal
    handleInteraction(x, y) {
        const object = this.mapManager.getObjectAt(x, y);
        if (object && object.name === 'Stardust') {
            // Remove the stardust object
            this.mapManager.currentMap.layers.find(l => l.name === 'objects').data[y][x] = 0;

            // Update game state
            this.gameState.player.stardust = (this.gameState.player.stardust || 0) + 1;
            this.gameState.addActivity(object.dialogText || 'You found a Stardust crystal!');
            this.gameState.save();
            
            // Re-render the map to show the change
            this.mapManager.renderMap();
            return true;
        }
        return false;
    }
}

export { StardustManager };