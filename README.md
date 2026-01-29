# Admin Panel - MERN Stack

A production-ready admin panel for managing a social media application with comprehensive user management, content moderation, reporting, and analytics capabilities.

## 🚀 Features

- **User Management**: View, search, filter, warn, block, and ban users
- **Post Moderation**: Hide, delete, and mark posts as sensitive
- **Comment Moderation**: Delete and hide inappropriate comments
- **Reports System**: Review and manage user-reported content
- **Live Session Control**: Monitor and terminate live broadcasts
- **Analytics Dashboard**: Real-time statistics and activity trends
- **JWT Authentication**: Secure admin authentication with HTTP-only cookies
- **Privacy-Focused**: Message monitoring limited to reported content only

## 📁 Project Structure

```
admin-panel/
├── client/                 # React frontend (Vite)
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── pages/         # Page components
│   │   ├── services/      # API service layer
│   │   ├── hooks/         # Custom React hooks
│   │   ├── routes/        # Route configuration
│   │   └── lib/           # Utility functions
│   └── package.json
├── server/                # Express backend
│   ├── src/
│   │   ├── config/       # Configuration files
│   │   ├── models/       # Sequelize models
│   │   ├── controllers/  # Route controllers
│   │   ├── routes/       # API routes
│   │   ├── middlewares/  # Custom middleware
│   │   ├── utils/        # Utility functions
│   │   └── scripts/      # Database seeding scripts
│   └── package.json
└── README.md
```

## 🛠️ Tech Stack

### Frontend
- React 18
- Vite
- Tailwind CSS
- shadcn/ui
- React Router
- Axios
- GSAP (animations)
- Lucide React (icons)

### Backend
- Node.js
- Express.js
- PostgreSQL
- Sequelize ORM
- JWT (authentication)
- bcrypt (password hashing)
- CORS

## 📋 Prerequisites

- Node.js (v16 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn

## 🔧 Installation

### 1. Clone the repository

```bash
git clone https://github.com/programmercework20-del/DoodlePad.git
cd admin-panel
```

### 2. Backend Setup

```bash
cd server
npm install
```

Create a `.env` file in the `server` directory:

```env
PORT=5000
NODE_ENV=development

DB_NAME=admin_db
DB_USER=postgres
DB_PASSWORD=your_password
DB_HOST=localhost
DB_PORT=5432
DB_DIALECT=postgres

JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=1d

CLIENT_URL=http://localhost:5173
```

### 3. Database Setup

Make sure PostgreSQL is running, then create the database:

```sql
CREATE DATABASE admin_db;
```

Seed the admin account:

```bash
npm run seed
```

This will create an admin account with:
- **Email**: admin@example.com
- **Password**: Admin@123

⚠️ **Important**: Change these credentials after first login!

### 4. Frontend Setup

```bash
cd ../client
npm install
```

Create a `.env` file in the `client` directory:

```env
VITE_API_URL=http://localhost:5000/api
```

## 🚀 Running the Application

### Start the Backend

```bash
cd server
npm run server
```

The server will start on http://localhost:5000

### Start the Frontend

```bash
cd client
npm run dev
```

The client will start on http://localhost:5173

## 📡 API Endpoints

### Authentication
- `POST /api/admin/login` - Admin login
- `POST /api/admin/logout` - Admin logout
- `GET /api/admin/verify` - Verify admin token
- `GET /api/admin/profile` - Get admin profile

### User Management
- `GET /api/users` - Get all users (with filters)
- `GET /api/users/:id` - Get user by ID
- `POST /api/users/:id/warn` - Warn user
- `POST /api/users/:id/block` - Block user
- `POST /api/users/:id/ban` - Ban user
- `POST /api/users/:id/unblock` - Unblock user
- `PATCH /api/users/:id/restrict` - Restrict user features

### Post Management
- `GET /api/posts` - Get all posts (with filters)
- `GET /api/posts/:id` - Get post by ID
- `POST /api/posts/:id/hide` - Hide post
- `DELETE /api/posts/:id` - Delete post
- `POST /api/posts/:id/mark-sensitive` - Mark post as sensitive
- `PATCH /api/posts/:id/comments` - Toggle comments

### Report Management
- `GET /api/reports` - Get all reports (with filters)
- `GET /api/reports/:id` - Get report by ID
- `PATCH /api/reports/:id/status` - Update report status
- `PATCH /api/reports/:id/priority` - Update report priority

### Analytics
- `GET /api/analytics/dashboard` - Get dashboard statistics
- `GET /api/analytics/trends` - Get activity trends

## 🔒 Security Features

- JWT-based authentication with HTTP-only cookies
- Password hashing with bcrypt
- CORS configuration
- Protected API routes
- Role-based access control
- Environment variable configuration

## 🎨 UI Components

The frontend uses **shadcn/ui** components for a modern, accessible interface:
- Buttons
- Cards
- Inputs
- Badges
- Dialogs
- And more...

## 📊 Dashboard Features

- **Real-time Statistics**: Total users, posts, reports, and active lives
- **User Status Breakdown**: Active, warned, blocked, and banned users
- **Content Overview**: Post statistics by status
- **Animated Stats**: Smooth GSAP animations on load
- **Responsive Design**: Works on all screen sizes

## 🔐 Default Admin Credentials

After running the seed script:
- **Email**: admin@example.com
- **Password**: Admin@123

⚠️ **Important**: Change these credentials immediately after first login!

## 🌟 Features to Implement

The following features are planned but not yet implemented:
- Email notifications
- Advanced analytics and charts
- Export functionality
- Audit logs
- Multi-admin support with different permission levels
- Two-factor authentication

## 🐛 Troubleshooting

### Database Connection Error
- Ensure PostgreSQL is running
- Verify database credentials in `.env`
- Check if the database exists

### CORS Error
- Verify `CLIENT_URL` in server `.env`
- Check if client is running on the correct port

### Authentication Issues
- Clear browser cookies
- Check if JWT_SECRET is set
- Verify token expiration settings

## 📝 License

MIT

## 👥 Contributing

Contributions are welcome! Please read the contributing guidelines before submitting PRs.

## 📧 Support

For support, please open an issue in the repository.
