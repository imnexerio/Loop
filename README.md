# Habit Tracker PWA

A modern Progressive Web App for tracking daily habits, built with React, TypeScript, Vite, Tailwind CSS, and Firebase Firestore.

## Features

- 🌓 **Automatic Theme Detection** - Adapts to your system's light/dark mode preference
- 📱 **PWA Support** - Install on any device and use offline
- 🔐 **Firebase Authentication** - Secure user authentication
- ☁️ **Cloud Storage** - Data synced via Firebase Firestore
- 🎨 **Modern UI** - Clean, responsive design with Tailwind CSS
- ⚡ **Fast** - Built with Vite for optimal performance

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Configure Firebase:
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Create a new project
   - Enable Firestore and Authentication
   - Copy your Firebase config and update `src/firebase/config.ts`

3. Run the development server:
```bash
npm run dev
```

4. Open your browser and visit `http://localhost:5173`

## Build for Production

```bash
npm run build
```

## Preview Production Build

```bash
npm run preview
```

## Tech Stack

- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **Firebase Firestore** - Database
- **Firebase Auth** - Authentication
- **Vite PWA Plugin** - Progressive Web App features

## Project Structure

```
Loop/
├── src/
│   ├── components/     # React components
│   │   └── Login.tsx   # Login/Signup page
│   ├── firebase/       # Firebase configuration
│   │   └── config.ts   # Firebase setup
│   ├── App.tsx         # Main app component
│   ├── main.tsx        # Entry point
│   └── index.css       # Global styles
├── public/             # Static assets
├── index.html          # HTML template
└── package.json        # Dependencies
```

## Next Steps

- [ ] Implement Firebase Authentication
- [ ] Create habit management dashboard
- [ ] Add habit tracking functionality
- [ ] Build streak counter
- [ ] Add calendar view
- [ ] Implement statistics and charts

## License

MIT
