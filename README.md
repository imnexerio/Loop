# Loop - Habit Tracker PWA 🌿

A modern Progressive Web App for tracking daily sessions with custom metrics, built with React, TypeScript, Vite, Tailwind CSS, and Firebase Firestore.

## ✨ Features

### 🔐 **Authentication**
- Email/Password signup and login
- Google Sign-In integration
- Secure Firebase Authentication
- Auto-login with session persistence

### 📊 **Analysis Tab**
- **Interactive Calendar** - Month view with session indicators
- **Day View** - Click any date to see all sessions
- **Session Tracking** - Multiple sessions per day with timestamps
- **Read-only History** - Past sessions cannot be modified
- **Session Indicators** - Green dots show days with logged data

### ✍️ **Session Logging**
- **Auto-save** - Sessions save automatically as you type (2-second debounce)
- **Rich Descriptions** - Multi-line text for detailed notes
- **Custom Metrics** - Track any metric with custom tags
- **Flexible Tracking** - Each session has its own timestamp

### 🏷️ **Custom Tags System**
Create custom tracking metrics in Profile:
- **Number** - Track values with min/max range (e.g., Mood 1-10)
- **Rating** - Star ratings (e.g., 1-5 stars)
- **Checkbox** - Simple Yes/No tracking
- **Text** - Free-form text notes
- **Time** - Track duration in minutes

Each tag can have:
- Custom name
- Input type
- Min/Max values
- Units (glasses, kg, minutes, etc.)

### 💬 **AI Chat Assistant**
- AI-powered insights about your habits
- Configurable LLM provider (Gemini/ChatGPT/Claude)
- Suggested questions
- Chat history
- *(AI integration placeholder - ready for API connection)*

### 👤 **Profile Management**
- User information display
- Tag creation and management
- Tag deletion (with confirmation)
- Settings for LLM provider
- Logout functionality

### 🎨 **UI/UX Features**
- **Automatic Theme Detection** - Follows system preference
- **Dark Mode** - Full dark theme support
- **Responsive Design** - Works on mobile, tablet, and desktop
- **Green Color Scheme** - Calming and productive
- **Bottom Navigation** - Easy thumb access on mobile
- **Floating Action Button** - Quick session creation
- **Smooth Animations** - Polished user experience

## 🗄️ **Data Structure**

```
users/{userId}/
  ├── profile
  ├── tags/{tagId}
  │     ├── name
  │     ├── type
  │     ├── config {min, max, unit}
  │     └── createdAt
  └── logs/{year}/months/{month}/days/{day}
        ├── date
        ├── sessions[]
        │     ├── timestamp
        │     ├── description
        │     └── tags {tagId: value}
        └── lastUpdated
```

## 🚀 **Getting Started**

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Firebase account

### Installation

1. **Install dependencies:**
```bash
npm install
```

2. **Configure Firebase:**
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Create a new project
   - Enable **Firestore Database**
   - Enable **Authentication** (Email/Password + Google)
   - Copy your Firebase config
   - Update `src/firebase/config.ts` with your credentials:

```typescript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
}
```

3. **Set up Firestore Rules:**
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

4. **Run the development server:**
```bash
npm run dev
```

5. **Open your browser** at `http://localhost:5173`

## 📦 **Build for Production**

```bash
npm run build
npm run preview
```

## 🛠️ **Tech Stack**

- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool & dev server
- **Tailwind CSS** - Styling
- **Firebase Firestore** - Database
- **Firebase Auth** - Authentication
- **Vite PWA Plugin** - Progressive Web App features

## 📱 **Project Structure**

```
Loop/
├── src/
│   ├── components/
│   │   ├── analysis/
│   │   │   ├── Calendar.tsx      # Month calendar view
│   │   │   └── DayView.tsx       # Session list for selected day
│   │   ├── AddSessionModal.tsx   # Session creation modal
│   │   ├── AnalysisTab.tsx       # Analysis tab container
│   │   ├── ChatTab.tsx           # AI chat interface
│   │   ├── Dashboard.tsx         # Main dashboard with tabs
│   │   ├── Login.tsx             # Login/Signup page
│   │   └── ProfileTab.tsx        # Profile & tag management
│   ├── contexts/
│   │   └── AuthContext.tsx       # Authentication context
│   ├── firebase/
│   │   └── config.ts             # Firebase configuration
│   ├── services/
│   │   └── firestore.ts          # Firestore CRUD operations
│   ├── types/
│   │   └── index.ts              # TypeScript interfaces
│   ├── App.tsx                   # Main app component
│   ├── main.tsx                  # Entry point
│   └── index.css                 # Global styles
├── public/                       # Static assets & PWA icons
├── index.html                    # HTML template
├── package.json                  # Dependencies
├── tailwind.config.js            # Tailwind configuration
├── tsconfig.json                 # TypeScript configuration
└── vite.config.ts                # Vite & PWA configuration
```

## 🎯 **Usage Guide**

### 1. **First Time Setup**
- Sign up with email/password or Google
- Go to Profile tab
- Create your first tags (e.g., Mood, Energy, Focus)

### 2. **Logging a Session**
- Click the **+** Floating Action Button
- Describe what you're doing
- Fill in your tag values (optional)
- Session auto-saves as you type!

### 3. **Viewing History**
- Go to Analysis tab
- Calendar shows green dots for days with sessions
- Click any date to view that day's sessions
- See all your logged data with timestamps

### 4. **AI Insights** *(Coming Soon)*
- Go to Chat tab
- Ask questions about your habits
- Get personalized suggestions
- Configure LLM provider in Profile

## 🔧 **Future Enhancements**

- [ ] Gemini API integration for chat
- [ ] Data visualization and charts
- [ ] Weekly/monthly summaries
- [ ] Export data to CSV/JSON
- [ ] Habit streaks and goals
- [ ] Reminders and notifications
- [ ] Data backup and sync
- [ ] Multiple user profiles
- [ ] Tag categories and colors
- [ ] Search and filter sessions

## 📝 **Data Flow**

1. User creates **tags** in Profile (e.g., "Mood", "Energy")
2. User clicks **FAB** to add a session
3. Modal opens with description textarea and tag inputs
4. Session **auto-saves** after 2 seconds of no typing
5. Data saved to Firestore: `/users/{uid}/logs/{year}/months/{month}/days/{day}`
6. Calendar updates with session indicator
7. Click date to view all sessions for that day

## 🌐 **PWA Features**

- ✅ Installable on mobile and desktop
- ✅ Offline support (service worker)
- ✅ Fast loading with caching
- ✅ App-like experience
- ✅ Auto-updates

## 📄 **License**

MIT

## 🤝 **Contributing**

Contributions welcome! Feel free to open issues or submit PRs.

---

Built with ❤️ using React, TypeScript, and Firebase
