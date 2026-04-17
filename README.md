# Trackmapgic

Upload SVG diagrams of motorsport circuits and convert them into georeferenced GPS track files (GeoJSON and GPX). Designed for racing teams, sim-racing communities, and track day enthusiasts who need to turn circuit maps into usable GPS data.

---

## Features

- **SVG upload & parsing** — upload any SVG circuit diagram and extract individual path elements
- **Interactive path editor** — toggle non-track elements (corner markers, labels, arrows) on/off visually before converting
- **Three georeferencing methods**:
  - **Known circuit** — search 45+ built-in motorsport circuits (Misano, Monza, Spa, Silverstone…) for automatic placement
  - **Map placement** — drag the track directly on an OpenStreetMap base layer, with rotation and scale sliders
  - **Two-point anchor** — pick two reference points on the SVG and enter their real GPS coordinates for a precise similarity transform
- **Export** — download as GeoJSON or GPX (compatible with Garmin, RaceLogic, ATLAS, etc.)
- **Manual map editor** — draw tracks from scratch on a Leaflet map with polygon/polyline tools
- **User accounts** — save and manage multiple track maps per account

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, React Router v6 |
| Map rendering | Leaflet, react-leaflet, leaflet-draw |
| Backend | Node.js, Express |
| Database | MongoDB (via Mongoose) |
| Authentication | JWT + bcrypt |
| File upload | Multer (in-memory) |
| SVG parsing | svgson + custom path sampler |
| Export | Native GeoJSON, custom GPX serialiser |

---

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- [npm](https://www.npmjs.com/) v9 or later
- A [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) account (free M0 tier is sufficient) — or a local MongoDB instance

---

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/your-username/trackmapgic.git
cd trackmapgic
```

### 2. Install server dependencies

```bash
cd server
npm install
```

### 3. Install client dependencies

```bash
cd ../client
npm install
```

---

## Configuration

### Server environment variables

Copy the example file and fill in your values:

```bash
cd server
cp .env.example .env
```

Open `server/.env` and set the following:

```env
PORT=5000

# MongoDB connection string from Atlas (or local)
MONGODB_URI=mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/trackmapgic?retryWrites=true&w=majority

# Long random secret used to sign JWT tokens — generate one with:
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=your_random_secret_here

# URL of the frontend dev server (for CORS)
CLIENT_URL=http://localhost:5173
```

> **Tip:** To get a MongoDB connection string, create a free cluster at [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas), click **Connect → Drivers**, and copy the URI. Replace `<user>` and `<password>` with your Atlas database user credentials, and add `trackmapgic` as the database name before the `?`.

---

## Running locally

Open **two terminals**:

**Terminal 1 — backend:**

```bash
cd server
npm run dev
```

You should see:
```
Connected to MongoDB
Server running on port 5000
```

**Terminal 2 — frontend:**

```bash
cd client
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Project structure

```
trackmapgic/
│
├── client/                         # React frontend (Vite)
│   ├── index.html
│   ├── vite.config.js              # Proxies /api to localhost:5000
│   └── src/
│       ├── api/
│       │   └── client.js           # Axios instance + downloadFile helper
│       ├── components/
│       │   ├── Navbar.jsx
│       │   └── ProtectedRoute.jsx
│       ├── context/
│       │   └── AuthContext.jsx     # Global auth state
│       ├── pages/
│       │   ├── Home.jsx            # Landing page
│       │   ├── Login.jsx
│       │   ├── Register.jsx
│       │   ├── Dashboard.jsx       # Map list + export + delete
│       │   ├── MapEditor.jsx       # Manual draw editor (Leaflet + leaflet-draw)
│       │   └── Upload.jsx          # SVG upload + georeference wizard
│       ├── App.jsx
│       └── main.jsx
│
└── server/                         # Express backend
    ├── .env.example
    └── src/
        ├── index.js                # Entry point, MongoDB connection
        ├── middleware/
        │   └── auth.js             # JWT verification middleware
        ├── models/
        │   ├── User.js             # Mongoose user schema
        │   └── TrackMap.js         # Mongoose map schema (stores GeoJSON)
        ├── routes/
        │   ├── auth.js             # POST /api/auth/register|login, GET /api/auth/me
        │   ├── maps.js             # CRUD + export for /api/maps
        │   └── convert.js          # POST /api/convert/svg, GET /api/convert/circuits
        └── utils/
            ├── svgParser.js        # SVG XML → sampled point arrays (handles transforms, all path commands)
            ├── circuits.js         # Built-in database of 45+ motorsport circuits
            └── gpxExport.js        # GeoJSON → GPX string converter
```

---

## API reference

All routes except `/api/auth/*` require a `Authorization: Bearer <token>` header.

### Auth

| Method | Route | Body | Description |
|---|---|---|---|
| POST | `/api/auth/register` | `{ name, email, password }` | Create account, returns JWT |
| POST | `/api/auth/login` | `{ email, password }` | Login, returns JWT |
| GET | `/api/auth/me` | — | Returns current user |

### Maps

| Method | Route | Description |
|---|---|---|
| GET | `/api/maps` | List all maps for current user |
| GET | `/api/maps/:id` | Get a single map (with GeoJSON) |
| POST | `/api/maps` | Create a new map |
| PUT | `/api/maps/:id` | Update a map |
| DELETE | `/api/maps/:id` | Delete a map |
| GET | `/api/maps/:id/export?format=geojson` | Download as GeoJSON |
| GET | `/api/maps/:id/export?format=gpx` | Download as GPX |

### Convert

| Method | Route | Description |
|---|---|---|
| POST | `/api/convert/svg` | Upload an SVG file (multipart), returns parsed path data |
| GET | `/api/convert/circuits?q=misano` | Search built-in circuit database |

---

## SVG upload workflow

1. **Upload** a `.svg` file — the parser extracts all `<path>` elements and samples them into polyline point arrays, correctly handling layer transforms, cubic/quadratic beziers, arcs, and all standard SVG path commands.
2. **Clean up** — toggle individual paths on/off. Non-track elements (corner number circles, text labels, arrows) can be removed before converting.
3. **Georeference** — choose one or more methods:
   - *Known circuit*: search by name, coordinates and scale are filled automatically, then fine-tune by dragging
   - *Map placement*: drag the track overlay directly on the live map, adjust rotation and scale with sliders
   - *Two-point anchor*: click two reference points on the SVG preview and enter their real-world GPS coordinates; the tool computes a similarity transform (rotation + uniform scale + translation)
4. **Save** — stored as a GeoJSON FeatureCollection in MongoDB, downloadable as `.geojson` or `.gpx`

---

## Deployment

### Frontend — Vercel

```bash
cd client
npm run build
```

Push to GitHub and connect the repo on [vercel.com](https://vercel.com). Set the root directory to `client/`. No additional configuration needed — Vite outputs a static site.

In production, set the `VITE_API_URL` if your backend is on a different domain, and update the `proxy` in `vite.config.js` accordingly.

### Backend — Railway or Render

Both [Railway](https://railway.app) and [Render](https://render.com) (free tier) support Node.js deployments.

1. Connect your GitHub repo
2. Set the root directory to `server/`
3. Set the start command to `npm start`
4. Add the environment variables (`MONGODB_URI`, `JWT_SECRET`, `CLIENT_URL`) in the platform's settings panel

### Environment variables in production

| Variable | Value |
|---|---|
| `MONGODB_URI` | Your MongoDB Atlas connection string |
| `JWT_SECRET` | A long random string (different from your dev secret) |
| `CLIENT_URL` | The Vercel deployment URL, e.g. `https://trackmapgic.vercel.app` |
| `PORT` | Set automatically by the platform |

---

## Contributing

Contributions are welcome. Please:

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Commit your changes with a clear message
4. Open a pull request against `main`

For significant changes, open an issue first to discuss the approach.

---

## License

MIT — see [LICENSE](LICENSE) for details.
