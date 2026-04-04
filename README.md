# 🌿 FoodBridge – Leftover Food Management System

A full-stack real-time food donation and tracking web application that connects **food donors** with **NGOs**, reducing food waste and feeding communities in need.

---

## 🚀 Features

### 👤 Roles
- **Donor**: Donate food, set pickup & delivery locations, track NGO in real time
- **NGO**: Accept/reject donations, navigate to pickup, share live location, mark as delivered

### 🗺️ Map Features (Leaflet.js + OpenStreetMap)
- Pick location by typing, live GPS, or clicking on map
- Reverse geocoding via Nominatim API
- Live NGO tracking updates every 5 seconds
- Route line from NGO → Pickup → Delivery
- Distance calculation (Haversine formula)

### 📱 PWA
- Installable on Android/iOS
- Offline-capable with service worker caching

---

## 🛠️ Tech Stack

| Layer      | Technology                    |
|------------|-------------------------------|
| Frontend   | HTML, CSS, Bootstrap 5, EJS   |
| Maps       | Leaflet.js + OpenStreetMap    |
| Backend    | Node.js + Express.js          |
| Database   | MongoDB + Mongoose            |
| Auth       | bcryptjs + express-session    |
| PWA        | manifest.json + service-worker|

---

## ⚙️ Setup & Installation

### Prerequisites
- [Node.js](https://nodejs.org/) v16+
- [MongoDB](https://www.mongodb.com/) (local or Atlas)

### Steps

```bash
# 1. Clone / extract the project
cd leftover-food-mgmt

# 2. Install dependencies
npm install

# 3. Configure environment
# Edit .env file:
MONGODB_URI=mongodb://localhost:27017/leftover_food_db
SESSION_SECRET=your_secret_key_here
PORT=3000

# 4. Start MongoDB (if running locally)
mongod

# 5. Run the application
npm start
# OR for development with auto-reload:
npm run dev

# 6. Open in browser
# http://localhost:3000
```

---

## 📁 Project Structure

```
leftover-food-mgmt/
├── server.js               # Main Express server
├── .env                    # Environment variables
├── package.json
├── models/
│   ├── User.js             # User schema (donor/ngo)
│   └── Food.js             # Food donation schema
├── routes/
│   ├── auth.js             # Login/register routes
│   ├── donor.js            # Donor feature routes
│   ├── ngo.js              # NGO feature routes
│   └── api.js              # REST API (tracking, stats)
├── middleware/
│   └── auth.js             # Session auth guards
├── views/
│   ├── partials/           # header, navbar, footer
│   ├── auth/               # login.ejs, register.ejs
│   ├── donor/              # dashboard, donate, delivery, history, track
│   └── ngo/                # dashboard, requests, navigate
└── public/
    ├── css/style.css        # All custom styles
    ├── js/app.js            # Frontend JS + PWA SW registration
    ├── manifest.json        # PWA manifest
    ├── service-worker.js    # Offline support
    └── images/              # PWA icons
```

---

## 🗄️ Database Collections

### `users`
| Field        | Type   | Description                  |
|--------------|--------|------------------------------|
| name         | String | Full name                    |
| email        | String | Unique email (login)         |
| password     | String | bcrypt hashed                |
| role         | String | `donor` or `ngo`             |
| organization | String | NGO org name (optional)      |
| phone        | String | Contact number               |
| address      | String | Address                      |

### `foods`
| Field             | Type   | Description                      |
|-------------------|--------|----------------------------------|
| name              | String | Food item name                   |
| quantity          | String | Amount (servings/kg)             |
| description       | String | Optional details                 |
| pickupLocation    | String | Human-readable address           |
| pickupLatitude    | Number | GPS lat                          |
| pickupLongitude   | Number | GPS lng                          |
| deliveryLocation  | String | Optional delivery address        |
| deliveryLatitude  | Number | GPS lat for delivery             |
| deliveryLongitude | Number | GPS lng for delivery             |
| status            | String | pending/accepted/rejected/picked_up/delivered |
| donorEmail        | String | References donor user            |
| ngoEmail          | String | Assigned NGO                     |
| ngoLatitude       | Number | Live NGO lat (updated real-time) |
| ngoLongitude      | Number | Live NGO lng (updated real-time) |
| ngoLastUpdate     | Date   | Timestamp of last NGO ping       |

---

## 🔄 User Flow

### Donor
1. Register → select "Donor"
2. Login → Dashboard
3. Click "Donate Food" → fill form → pick pickup location
4. Optionally set delivery location on next page
5. View History → see status badges
6. If accepted → click "Track NGO" to see live map

### NGO
1. Register → select "NGO"
2. Login → Dashboard with stats
3. Click "View Requests" → see pending donations
4. Accept a donation → appears in "My Active"
5. Click "Navigate & Track" → map shows route + shares live location
6. Click "Mark as Picked Up" → then "Mark as Delivered"

---

## 🌐 API Endpoints

| Method | Endpoint                    | Description                    |
|--------|-----------------------------|--------------------------------|
| POST   | `/api/ngo/location/:foodId` | NGO updates live GPS location  |
| GET    | `/api/track/:foodId`        | Donor polls NGO live location  |
| GET    | `/api/stats`                | Get pending donation count     |

---

## 📝 Notes

- Maps use **OpenStreetMap** (free, no billing)
- Geocoding uses **Nominatim API** (free, no API key needed)
- Live tracking polls every **5 seconds**
- Session persists for **24 hours**
- Minimum donation quantity: **1 serving/kg**

---

## 💡 Future Enhancements

- Email/SMS notifications on status change
- WebSocket for truly real-time tracking (instead of polling)
- Admin panel for analytics
- Rating system for donors and NGOs
- Multi-language support

---

*Built with ❤️ to fight food waste and hunger.*

---

## 🔐 Admin Panel

### First-time Setup
```bash
# Create your first admin account (run once):
node scripts/create-admin.js
```
Then login at `http://localhost:3000/login` with admin credentials.

### Admin Features

| Feature | Description |
|---|---|
| **Dashboard** | Live stats, monthly donation trend chart, status donut, recent activity |
| **User Management** | List all donors & NGOs, search/filter, paginated table |
| **User Detail** | Full profile, donation history, edit name/phone/org/address |
| **Ban / Unban** | Suspend accounts with reason, prevent login |
| **Delete User** | Permanently remove user account |
| **Reset Password** | Set any user's password |
| **Donation Management** | List all donations, search by name/donor/NGO/status |
| **Donation Detail** | Full detail with map showing pickup, delivery, NGO location |
| **Override Status** | Force-update any donation's status |
| **Delete Donation** | Permanently remove donation record |
| **Analytics** | Daily/monthly charts, delivery rate, rejection rate, top donors & NGOs |
| **Settings** | Change admin password, create additional admin accounts |

### Admin URL Structure
```
/admin/dashboard          - Overview & stats
/admin/users              - All users (donor + NGO)
/admin/users/:id          - User detail + edit + ban + reset password
/admin/donations          - All donations
/admin/donations/:id      - Donation detail + map + force status
/admin/analytics          - Charts & insights
/admin/settings           - Password & admin management
```
