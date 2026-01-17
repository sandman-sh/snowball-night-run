# 🎮 Snowball Night Run

An endless runner game built with React Native and Expo, where you control a snowball rolling through a night-time winter landscape. Jump over gaps, collect gift boxes, and see how far you can go!

## 📹 Gameplay Video

<video src="./demo.mp4" controls width="100%"></video>

## ✨ Features

- **Smooth Physics**: 60 FPS game loop with fixed timestep physics
- **Double Jump Mechanics**: Single tap to jump, double tap for a mid-air double jump
- **Coyote Time & Jump Buffering**: Forgiving jump mechanics for better gameplay feel
- **Collectibles**: Collect gift boxes scattered across platforms for bonus points
- **Dynamic Difficulty**: Game speed gradually increases as you progress
- **Beautiful Night Theme**: Dark winter night aesthetic with snowflake particles
- **Background Music**: Atmospheric background music that plays during gameplay
- **Haptic Feedback**: Tactile feedback on supported devices for enhanced immersion
- **3D Gift Boxes**: Stylized 3D gift boxes with ribbons and shadows
- **Particle Effects**: Snow particles and death particle effects

## 🎯 How to Play

1. **Tap** to jump when on the ground
2. **Double tap** quickly to perform a double jump in mid-air
3. **Collect gift boxes** for bonus points (+10 points each)
4. **Avoid falling** into gaps between platforms
5. **Survive as long as possible** - the game gets faster over time!

### Controls
- **Single Tap**: Jump (when on ground or during coyote time)
- **Double Tap**: Double jump (must be within 300ms of first tap)
- **Jump Buffer**: Tap while falling to auto-jump when landing

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or higher)
- Bun (package manager)
- Expo CLI or Expo Go app on your device

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd snowball-night-run
```

2. Install dependencies:
```bash
bun install
```

3. Start the development server:
```bash
bun start
```

### Available Scripts

- `bun start` - Start the Expo development server with tunnel
- `bun start-web` - Start the web version with tunnel
- `bun start-web-dev` - Start web version with debug logging
- `bun lint` - Run ESLint

## 🛠️ Tech Stack

- **Framework**: React Native with Expo (~54.0.27)
- **Language**: TypeScript
- **Audio**: expo-av for background music
- **Haptics**: expo-haptics for tactile feedback
- **Fonts**: expo-font with custom Minecraft-style font
- **Routing**: expo-router
- **Package Manager**: Bun

## 📱 Platform Support

- ✅ iOS
- ✅ Android
- ✅ Web

## 🎨 Game Mechanics

### Physics
- **Gravity**: 0.6 units/frame
- **Jump Force**: -14 units (initial jump)
- **Double Jump Force**: -11 units
- **Terminal Velocity**: 20 units/frame
- **Initial Speed**: 3.5 units/frame
- **Max Speed**: 9 units/frame

### Game Features
- **Coyote Time**: 8 frames of grace period after leaving a platform
- **Jump Buffer**: 6 frames window to queue a jump before landing
- **Landing Tolerance**: 30 pixels for collision detection
- **Dynamic Tile Generation**: Procedurally generated platforms with varying widths and gaps

## 📂 Project Structure

```
rork-snowball-night-run/
├── app/
│   ├── index.tsx          # Main game component
│   ├── _layout.tsx        # App layout
│   └── +not-found.tsx     # 404 page
├── assets/
│   ├── images/            # App icons and images
│   └── music.mp3          # Background music
├── constants/
│   └── colors.ts          # Color constants
├── app.json               # Expo configuration
├── package.json           # Dependencies
└── tsconfig.json          # TypeScript configuration
```

## 🎵 Audio

The game includes background music (`assets/music.mp3`) that:
- Loops continuously during gameplay
- Starts when the game begins
- Pauses when the game ends
- Plays at 55% volume for optimal balance

## 🐛 Known Issues / Future Improvements

- [ ] Add high score persistence
- [ ] Add power-ups or special abilities
- [ ] Add different difficulty levels
- [ ] Add achievements system
- [ ] Add sound effects for jumps and collectibles

## 📄 License

This project is private.

## 👤 Author

Built with ❄️ and React Native

---

**Enjoy the game!** 🎮❄️
