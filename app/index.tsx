import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  Text,
  Animated,
  Platform,
  StatusBar,
  PanResponder,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useFonts } from 'expo-font';
import { Audio } from 'expo-av';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const TARGET_FPS = 60;
const TIME_STEP = 1000 / TARGET_FPS;

const GRAVITY = 0.6;
const JUMP_FORCE = -14;
const DOUBLE_JUMP_FORCE = -11;
const TERMINAL_VELOCITY = 20;
const INITIAL_SPEED = 3.5;
const SPEED_INCREMENT = 0.0008;
const MAX_SPEED = 9;
const SPAWN_AHEAD_DISTANCE = SCREEN_WIDTH * 1.5;

const SNOWBALL_SIZE = 40;
const TILE_HEIGHT = 60;
const TILE_Y = SCREEN_HEIGHT - 200;

const TILE_WIDTHS = [120, 180, 250, 400];
const GAP_SIZES = [100, 150, 200];

const COYOTE_TIME = 8;
const JUMP_BUFFER_TIME = 6;
const LANDING_TOLERANCE = 30;

type GameState = 'start' | 'playing' | 'gameOver';

interface TileData {
  id: number;
  x: number;
  width: number;
  type: 'short' | 'medium' | 'long';
}

// Removed ObstacleData
interface CollectibleData {
  id: number;
  x: number;
  tileId: number;
  collected: boolean;
  // added for 3D rotation effect or just static
  rotation?: number; 
}

interface ParticleData {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  opacity: number;
  size: number;
  life: number;
}

// Memoized Components to reduce render cost
const Tile = React.memo(({ tile, cameraX }: { tile: TileData; cameraX: number }) => {
  const screenX = tile.x - cameraX;
  if (screenX < -tile.width || screenX > SCREEN_WIDTH) return null;
  
  return (
    <View
      style={[
        styles.tile,
        {
          left: screenX + SCREEN_WIDTH / 2 - tile.width / 2,
          width: tile.width,
          top: TILE_Y,
        },
      ]}
    >
      <View style={styles.tileTop} />
      <View style={styles.tileSnow} />
    </View>
  );
});
Tile.displayName = 'Tile';

// Removed Tree and Obstacle components

const Collectible = React.memo(({ collectible, cameraX }: { collectible: CollectibleData; cameraX: number }) => {
  if (collectible.collected) return null;
  const screenX = collectible.x - cameraX;
  if (screenX < -100 || screenX > SCREEN_WIDTH) return null;

  // 3D Gift Box Construction
  return (
    <View style={[styles.collectible, { left: screenX + SCREEN_WIDTH / 2 }]}>
      <View style={styles.giftContainer}>
        {/* Shadow */}
        <View style={styles.giftShadow} />
        
        {/* 3D Box Construction */}
        <View style={styles.giftBoxSide} />
        <View style={styles.giftBoxTop} />
        <View style={styles.giftBoxFront}>
           <View style={styles.giftRibbonV} />
           <View style={styles.giftRibbonH} />
        </View>
        <View style={styles.giftBoxTopRibbon} />
      </View>
    </View>
  );
});
Collectible.displayName = 'Collectible';

export default function GameScreen() {
  const [fontsLoaded] = useFonts({
    'Minecraft': 'https://raw.githubusercontent.com/google/fonts/main/ofl/vt323/VT323-Regular.ttf',
  });

  const [gameState, setGameState] = useState<GameState>('start');
  const [score, setScore] = useState<number>(0);
  const soundRef = useRef<Audio.Sound | null>(null);
  
  const stateRef = useRef({
    snowballY: TILE_Y - SNOWBALL_SIZE,
    velocity: 0,
    cameraX: 0,
    speed: INITIAL_SPEED,
    isOnGround: true,
    hasDoubleJump: false,
    score: 0,
    lastTime: 0,
    accumulator: 0,
    frameCounter: 0,
    coyoteTimer: 0,
    jumpBufferTimer: 0,
    lastGroundY: TILE_Y - SNOWBALL_SIZE,
  });

  // React State (for Render)
  // removed renderTrigger since setScore drives the render

  const [tiles, setTiles] = useState<TileData[]>([]);
  // Removed obstacles state
  const [collectibles, setCollectibles] = useState<CollectibleData[]>([]);
  const [particles, setParticles] = useState<ParticleData[]>([]);
  const [deathParticles, setDeathParticles] = useState<ParticleData[]>([]);
  
  const tileIdCounter = useRef(0);
  // Removed obstacleIdCounter
  const collectibleIdCounter = useRef(0);
  const particleIdCounter = useRef(0);
  // Removed dodgedObstacles
  
  const shatterOpacity = useRef(new Animated.Value(0)).current;

  // Background Music
  useEffect(() => {
    let sound: Audio.Sound | null = null;

    const setupAudio = async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
        });

        const { sound: loadedSound } = await Audio.Sound.createAsync(
          require('../assets/music.mp3'),
          { shouldPlay: false, isLooping: true, volume: 0.55 }
        );
        
        sound = loadedSound;
        soundRef.current = loadedSound;
      } catch (error) {
        console.log('Error loading audio:', error);
      }
    };

    setupAudio();

    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, []);

  // Initialize Game
  const initGame = useCallback(() => {
    tileIdCounter.current = 0;
    collectibleIdCounter.current = 0;
    particleIdCounter.current = 0;
    shatterOpacity.setValue(0);

    stateRef.current = {
      snowballY: TILE_Y - SNOWBALL_SIZE,
      velocity: 0,
      cameraX: 0,
      speed: INITIAL_SPEED,
      isOnGround: true,
      hasDoubleJump: false,
      score: 0,
      lastTime: 0,
      accumulator: 0,
      frameCounter: 0,
      coyoteTimer: 0,
      jumpBufferTimer: 0,
      lastGroundY: TILE_Y - SNOWBALL_SIZE,
    };

    // Initial Tiles (Start Platform)
    const initialTiles: TileData[] = [];
    // Start with a very long safe platform centered at 0
    // Center is 0. Width 600.
    initialTiles.push({
      id: tileIdCounter.current++,
      x: 0,
      width: 600,
      type: 'long',
    });

    let currentCenter = 0;
    let currentWidth = 600;

    // Generate a few more tiles ahead
    for (let i = 0; i < 5; i++) {
      const width = TILE_WIDTHS[Math.floor(Math.random() * TILE_WIDTHS.length)];
      const gap = GAP_SIZES[Math.floor(Math.random() * GAP_SIZES.length)];
      
      // Calculate new center:
      // Prev Center + Prev Half Width + Gap + New Half Width
      const newCenter = currentCenter + (currentWidth / 2) + gap + (width / 2);
      
      initialTiles.push({
        id: tileIdCounter.current++,
        x: newCenter,
        width,
        type: 'medium',
      });

      currentCenter = newCenter;
      currentWidth = width;
    }

    setTiles(initialTiles);
    // Sync Ref immediately so loop has data
    gameDataRef.current.tiles = initialTiles;
    gameDataRef.current.collectibles = [];
    gameDataRef.current.particles = [];

    setCollectibles([]);
    setDeathParticles([]);
    setScore(0);
  }, [shatterOpacity]);

  const handleStart = useCallback(async () => {
    initGame();
    setGameState('playing');
    
    // Start background music when game starts
    if (soundRef.current) {
      try {
        const status = await soundRef.current.getStatusAsync();
        if (status.isLoaded) {
          if (status.isPlaying) {
            // If already playing, just reset position
            await soundRef.current.setPositionAsync(0);
          } else {
            // Start playing from beginning
            await soundRef.current.setPositionAsync(0);
            await soundRef.current.playAsync();
          }
        } else {
          // If not loaded yet, wait and retry
          setTimeout(async () => {
            if (soundRef.current) {
              try {
                await soundRef.current.setPositionAsync(0);
                await soundRef.current.playAsync();
              } catch (err) {
                console.log('Error playing music on retry:', err);
              }
            }
          }, 200);
        }
      } catch (error) {
        console.log('Error playing music:', error);
        // Retry once after a short delay
        setTimeout(async () => {
          if (soundRef.current) {
            try {
              await soundRef.current.setPositionAsync(0);
              await soundRef.current.playAsync();
            } catch (err) {
              console.log('Error playing music on retry:', err);
            }
          }
        }, 300);
      }
    }
  }, [initGame]);

  const lastTapTimeRef = useRef(0);

  const handleTap = useCallback(() => {
    if (gameState !== 'playing') {
      if (gameState === 'start' || gameState === 'gameOver') {
        handleStart();
      }
      return;
    }

    const state = stateRef.current;
    const now = Date.now();
    const timeSinceLastTap = now - lastTapTimeRef.current;
    
    // First tap or single tap (on ground/coyote)
    if (state.isOnGround || state.coyoteTimer > 0) {
      state.velocity = JUMP_FORCE;
      state.isOnGround = false;
      state.coyoteTimer = 0;
      state.hasDoubleJump = true;
      lastTapTimeRef.current = now;
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    // Double jump (in air, within 300ms of last tap)
    else if (!state.isOnGround && state.hasDoubleJump && timeSinceLastTap < 300) {
      state.velocity = DOUBLE_JUMP_FORCE;
      state.hasDoubleJump = false;
      lastTapTimeRef.current = 0; // Reset to prevent triple jump
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    // Jump buffer for landing soon
    else if (!state.isOnGround) {
      state.jumpBufferTimer = JUMP_BUFFER_TIME;
      lastTapTimeRef.current = now;
    }
  }, [gameState, handleStart]);

  const handleTapRef = useRef<() => void>(() => {});
  useEffect(() => {
    handleTapRef.current = handleTap;
  }, [handleTap]);

  // PanResponder for better touch handling (fixes "jump touch" delay)
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        handleTapRef.current?.();
      },
    })
  ).current;

  const handleGameOver = useCallback(async () => {
    setGameState('gameOver');
    
    if (soundRef.current) {
      await soundRef.current.pauseAsync();
    }
    
    const shatterParticles: ParticleData[] = [];
    for (let i = 0; i < 20; i++) {
      const angle = (Math.PI * 2 * i) / 20;
      const speed = 2 + Math.random() * 4;
      shatterParticles.push({
        id: particleIdCounter.current++,
        x: SCREEN_WIDTH / 2,
        y: stateRef.current.snowballY + SNOWBALL_SIZE / 2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        opacity: 1,
        size: 8,
        life: 1.0,
      });
    }
    setDeathParticles(shatterParticles);
    
    Animated.timing(shatterOpacity, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
    
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [shatterOpacity]);

  // Main Game Loop
  // Removed abandoned useEffect hook


  // Re-implementing with full Ref-based state for Game Loop to avoid closure staleness
  const gameDataRef = useRef({
    tiles: [] as TileData[],
    collectibles: [] as CollectibleData[],
    particles: [] as ParticleData[],
  });

  // Removed redundant sync effects - initGame handles initial population,
  // and loop handles updates.


  useEffect(() => {
    if (gameState !== 'playing') return;

    let animationFrameId: number;
    
    const updatePhysics = () => {
      const state = stateRef.current;
      const gameData = gameDataRef.current;

      state.velocity += GRAVITY;
      state.velocity = Math.min(state.velocity, TERMINAL_VELOCITY);
      state.snowballY += state.velocity;
      
      state.speed = Math.min(state.speed + SPEED_INCREMENT, MAX_SPEED);
      state.cameraX += state.speed;
      state.score += state.speed / 100;

      if (state.jumpBufferTimer > 0) state.jumpBufferTimer--;
      if (state.coyoteTimer > 0) state.coyoteTimer--;

      const snowballBottom = state.snowballY + SNOWBALL_SIZE;
      const snowballWorldX = state.cameraX;
      const snowballLeft = snowballWorldX - SNOWBALL_SIZE / 2;
      const snowballRight = snowballWorldX + SNOWBALL_SIZE / 2;

      let onTile = false;
      let shouldLand = false;

      for (const tile of gameData.tiles) {
        const halfWidth = tile.width / 2;
        const tileLeft = tile.x - halfWidth;
        const tileRight = tile.x + halfWidth;

        const horizontalOverlap = snowballRight > tileLeft && snowballLeft < tileRight;

        if (horizontalOverlap) {
          const distanceToSurface = snowballBottom - TILE_Y;
          
          if (distanceToSurface >= 0 && distanceToSurface <= LANDING_TOLERANCE && state.velocity >= 0) {
            state.snowballY = TILE_Y - SNOWBALL_SIZE;
            state.velocity = 0;
            state.isOnGround = true;
            state.hasDoubleJump = false;
            state.coyoteTimer = COYOTE_TIME;
            state.lastGroundY = state.snowballY;
            shouldLand = true;
            onTile = true;

            if (state.jumpBufferTimer > 0) {
              state.velocity = JUMP_FORCE;
              state.isOnGround = false;
              state.hasDoubleJump = true;
              state.jumpBufferTimer = 0;
              if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
            break;
          } else if (Math.abs(state.snowballY - state.lastGroundY) < 5) {
            onTile = true;
          }
        }
      }

      if (!shouldLand && state.isOnGround && !onTile) {
        state.isOnGround = false;
        state.coyoteTimer = COYOTE_TIME;
      }

      if (state.snowballY > SCREEN_HEIGHT + 100) {
        handleGameOver();
        return;
      }

      // 3. Spawning Logic
      const activeTiles = gameData.tiles.filter(t => t.x + t.width / 2 > state.cameraX - SCREEN_WIDTH);
      
      const lastTile = activeTiles[activeTiles.length - 1];
      const lastTileRight = lastTile ? lastTile.x + lastTile.width / 2 : 0;
      if (lastTile && lastTileRight < state.cameraX + SPAWN_AHEAD_DISTANCE) {
         const width = TILE_WIDTHS[Math.floor(Math.random() * TILE_WIDTHS.length)];
         const gap = GAP_SIZES[Math.floor(Math.random() * GAP_SIZES.length)];
         const newCenter = lastTile.x + (lastTile.width / 2) + gap + (width / 2);
         
         const newTile: TileData = {
           id: tileIdCounter.current++,
           x: newCenter,
           width,
           type: 'medium',
         };
         activeTiles.push(newTile);

         if (Math.random() < 0.3) {
           gameData.collectibles.push({
             id: collectibleIdCounter.current++,
             x: newCenter,
             tileId: newTile.id,
             collected: false,
           });
         }
      }

      // 4. Update Entities (Collectibles)
      gameData.collectibles = gameData.collectibles.filter(c => c.x > state.cameraX - SCREEN_WIDTH);
      for (const col of gameData.collectibles) {
        if (col.collected) continue;
        const dx = Math.abs(col.x - state.cameraX);
        if (dx < 40 && Math.abs(state.snowballY - (TILE_Y - 70)) < 50) {
           col.collected = true;
           state.score += 10;
           if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
      }

      // 5. Particles
      if (gameData.particles.length < 50 && Math.random() < 0.2) {
           gameData.particles.push({
             id: particleIdCounter.current++,
             x: Math.random() * SCREEN_WIDTH,
             y: -20,
             vx: (Math.random() - 0.5) * 2,
             vy: 1 + Math.random() * 3,
             opacity: 0.3 + Math.random() * 0.7,
             size: 2 + Math.random() * 4,
             life: 1,
           });
      }
      
      gameData.particles = gameData.particles.map(p => ({
        ...p,
        x: p.x + p.vx,
        y: p.y + p.vy,
      })).filter(p => p.y < SCREEN_HEIGHT);

      gameData.tiles = activeTiles;
    };

    const gameLoop = (time: number) => {
      const state = stateRef.current;
      
      if (state.lastTime === 0) {
        state.lastTime = time;
      }
      
      const deltaTime = time - state.lastTime;
      state.lastTime = time;
      state.accumulator += deltaTime;

      // Fixed Time Step
      while (state.accumulator >= TIME_STEP) {
        updatePhysics();
        state.accumulator -= TIME_STEP;
      }

      // Render (throttle React state updates a bit for smoother perf)
      const gameData = gameDataRef.current;
      state.frameCounter = (state.frameCounter ?? 0) + 1;
      if (state.frameCounter % 2 === 0) {
        setTiles([...gameData.tiles]);
        setCollectibles([...gameData.collectibles]);
        setParticles([...gameData.particles]);
        setScore(Math.floor(state.score));
      }
      
      if (gameState === 'playing') {
        animationFrameId = requestAnimationFrame(gameLoop);
      }
    };

    animationFrameId = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [gameState, handleGameOver]);

  // Render Helpers
  const cameraX = stateRef.current.cameraX;

  if (!fontsLoaded) return null;

  return (
    <View testID="game-root" style={styles.container} {...panResponder.panHandlers}>
      <StatusBar hidden />
      
      {/* Background with Gradient via Views */}
      <View style={styles.sky}>
        <View style={styles.skyGradient1} />
        <View style={styles.skyGradient2} />
      </View>

      {/* Stars / Distant Snow */}
      {particles.map(p => (
         <View key={p.id} style={[styles.snowflake, { 
           left: p.x, 
           top: p.y, 
           width: p.size, 
           height: p.size, 
           opacity: p.opacity 
         }]} />
      ))}

      {gameState === 'start' && (
        <View style={styles.centerContainer}>
          <Text style={styles.title}>SNOWBALL{'\n'}NIGHT RUN</Text>
          <Text style={styles.subtitle}>TAP TO JUMP{'\n'}DOUBLE TAP TO DOUBLE JUMP</Text>
        </View>
      )}

      {gameState === 'gameOver' && (
        <View style={styles.centerContainer}>
          <Text style={styles.gameOverTitle}>GAME OVER</Text>
          <Text style={styles.scoreText}>SCORE: {score}</Text>
          <Text style={styles.retryText}>TAP TO RETRY</Text>
        </View>
      )}

      {gameState === 'playing' && (
        <View style={styles.scoreContainer}>
          <Text style={styles.gameScore}>{score}</Text>
        </View>
      )}

      {/* Game World */}
      <View style={styles.worldContainer}>
        {tiles.map(tile => <Tile key={tile.id} tile={tile} cameraX={cameraX} />)}
        {collectibles.map(col => <Collectible key={col.id} collectible={col} cameraX={cameraX} />)}
        
        {/* Snowball */}
        {gameState !== 'gameOver' && (
          <View style={[styles.snowball, {
            top: stateRef.current.snowballY,
            left: SCREEN_WIDTH / 2 - SNOWBALL_SIZE / 2,
            transform: [{ rotate: `${(cameraX * 2) % 360}deg` }] // Rotate rolling effect
          }]} />
        )}

        {/* Death Particles */}
        {deathParticles.map(p => (
          <Animated.View key={p.id} style={[styles.deathParticle, {
            left: p.x,
            top: p.y,
            opacity: shatterOpacity.interpolate({ inputRange: [0,1], outputRange: [0, 1] })
          }]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050510',
    overflow: 'hidden',
  },
  sky: {
    ...StyleSheet.absoluteFillObject,
  },
  skyGradient1: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT / 2,
    backgroundColor: '#0a0a20',
    opacity: 0.5,
  },
  skyGradient2: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT / 2,
    backgroundColor: '#151530',
    opacity: 0.3,
  },
  centerContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  worldContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  title: {
    fontFamily: 'Minecraft',
    fontSize: 60,
    color: '#fff',
    textAlign: 'center',
    textShadowColor: '#4fc3f7',
    textShadowRadius: 10,
    lineHeight: 60,
  },
  subtitle: {
    fontFamily: 'Minecraft',
    fontSize: 24,
    color: '#81d4fa',
    marginTop: 20,
    letterSpacing: 2,
  },
  gameOverTitle: {
    fontFamily: 'Minecraft',
    fontSize: 60,
    color: '#ff5252',
    textAlign: 'center',
  },
  scoreText: {
    fontFamily: 'Minecraft',
    fontSize: 32,
    color: '#fff',
    marginTop: 10,
  },
  retryText: {
    fontFamily: 'Minecraft',
    fontSize: 20,
    color: '#aaa',
    marginTop: 20,
  },
  scoreContainer: {
    position: 'absolute',
    top: 50,
    width: '100%',
    alignItems: 'center',
    zIndex: 50,
  },
  gameScore: {
    fontFamily: 'Minecraft',
    fontSize: 48,
    color: '#fff',
    textShadowColor: 'black',
    textShadowRadius: 2,
    textShadowOffset: { width: 2, height: 2 },
  },
  tile: {
    position: 'absolute',
    height: TILE_HEIGHT + 200, // Extend down
    backgroundColor: '#1a237e', // Dark blue base
  },
  tileTop: {
    height: 12,
    backgroundColor: '#e3f2fd', // Snow layer
    width: '100%',
  },
  tileSnow: {
    position: 'absolute',
    top: 12,
    width: '100%',
    height: 10,
    backgroundColor: '#90caf9',
    opacity: 0.5,
  },
  snowball: {
    position: 'absolute',
    width: SNOWBALL_SIZE,
    height: SNOWBALL_SIZE,
    borderRadius: SNOWBALL_SIZE / 2,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#e1f5fe',
    shadowColor: '#fff',
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 5,
  },
  collectible: {
    position: 'absolute',
    top: TILE_Y - 70, // Slightly higher to sit on top of tile
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  giftContainer: {
    width: 32,
    height: 32,
    position: 'relative',
  },
  giftShadow: {
    position: 'absolute',
    bottom: -5,
    left: 2,
    width: 28,
    height: 8,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 10,
  },
  giftBoxFront: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 32,
    height: 32,
    backgroundColor: '#d32f2f', // Red
    borderWidth: 1,
    borderColor: '#b71c1c',
    zIndex: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  giftBoxTop: {
    position: 'absolute',
    top: -10, // Shift up
    left: 5,  // Shift right
    width: 32,
    height: 10,
    backgroundColor: '#ff5252', // Lighter red for top
    transform: [{ skewX: '-45deg' }],
    borderWidth: 1,
    borderColor: '#d32f2f',
    zIndex: 1,
  },
  giftBoxSide: {
    position: 'absolute',
    top: -5,
    right: -5,
    width: 10,
    height: 32,
    backgroundColor: '#b71c1c', // Darker red for side
    transform: [{ skewY: '-45deg' }],
    borderWidth: 1,
    borderColor: '#7f0000',
    zIndex: 1,
  },
  giftRibbonV: {
    position: 'absolute',
    left: 12, // Center
    width: 8,
    height: '100%',
    backgroundColor: '#fff',
  },
  giftRibbonH: {
    position: 'absolute',
    top: 12, // Center
    width: '100%',
    height: 8,
    backgroundColor: '#fff',
  },
  giftBoxTopRibbon: {
     position: 'absolute',
     top: -10,
     left: 17, // aligned with skew
     width: 8,
     height: 10,
     backgroundColor: '#eee',
     transform: [{ skewX: '-45deg' }],
     zIndex: 3,
  },
  snowflake: {
    position: 'absolute',
    backgroundColor: '#fff',
    borderRadius: 99,
  },
  deathParticle: {
    position: 'absolute',
    width: 8,
    height: 8,
    backgroundColor: '#fff',
    borderRadius: 2,
  },
});
