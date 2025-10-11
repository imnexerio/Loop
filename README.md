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
- **Gemini AI Integration** - Powered by Google's Gemini AI
- Personalized habit insights based on your data
- Pattern recognition and suggestions
- Natural conversation about your progress
- Context-aware responses using your recent logs
- Markdown-formatted responses with lists and formatting
- Suggested questions for quick insights

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
   - Create a `.env` file in the project root:

```bash
# Firebase Configuration
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

3. **Configure Gemini AI (Optional - for Chat feature):**
   - Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
   - Create a free API key
   - Add to your `.env` file:

```bash
# Gemini AI Configuration
VITE_GEMINI_API_KEY=your_gemini_api_key_here
```

   > **Note:** The chat feature will work without an API key but will show setup instructions. The free tier of Gemini includes 60 requests per minute.

4. **Set up Firestore Rules:**
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

5. **Run the development server:**
```bash
npm run dev
```

6. **Open your browser** at `http://localhost:5173`

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
│   │   ├── firestore.ts          # Firestore CRUD operations
│   │   ├── dataManager.ts        # Unified data layer with caching
│   │   └── gemini.ts             # Gemini AI integration
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

### 4. **AI Insights**
- Go to Chat tab
- Ask questions about your habits (e.g., "What patterns do you notice?")
- Get personalized suggestions based on your data
- Use suggested questions for quick insights
- AI analyzes your last 7 days of sessions automatically

## 🔧 **Future Enhancements**

- [x] Gemini AI integration for chat ✅
- [x] Markdown-formatted AI responses ✅
- [x] Context-aware AI using user data ✅
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

## ❓ FAQ: Where do I get the .env values? Is it free?

- Firebase values (VITE_FIREBASE_...)
  - Get them from Firebase Console:
    1) Go to https://console.firebase.google.com
    2) Open your project > Gear icon (Project settings)
    3) General tab > Your apps > Web app > SDK setup and configuration > Config
    4) Copy these fields into your .env:
       - apiKey            -> VITE_FIREBASE_API_KEY
       - authDomain        -> VITE_FIREBASE_AUTH_DOMAIN
       - projectId         -> VITE_FIREBASE_PROJECT_ID
       - storageBucket     -> VITE_FIREBASE_STORAGE_BUCKET
       - messagingSenderId -> VITE_FIREBASE_MESSAGING_SENDER_ID
       - appId             -> VITE_FIREBASE_APP_ID

- Gemini API key (VITE_GEMINI_API_KEY)
  - Get it from Google AI Studio:
    1) Visit https://aistudio.google.com/app/apikey (or https://makersuite.google.com/app/apikey)
    2) Create an API key
    3) Put it in your .env as VITE_GEMINI_API_KEY

Is it free?
- Firebase: You can start on the Spark (Free) plan. It includes generous free quotas for Authentication and Firestore suitable for development and small personal projects. For production apps with higher traffic, you may need to upgrade to a paid plan. See official pricing: https://firebase.google.com/pricing
- Gemini API: Google AI Studio offers a free tier for development with rate limits. It’s typically enough for testing the chat feature locally. For heavier/prod usage you may need to enable billing or use Google Cloud’s Generative AI pricing. See: https://ai.google.dev/pricing

Tip: After creating or changing the .env file, restart the Vite dev server so the new values are picked up.

## 📄 **License**

MIT

## 🤝 **Contributing**

Contributions welcome! Feel free to open issues or submit PRs.

---

Built with ❤️ using React, TypeScript, and Firebase
