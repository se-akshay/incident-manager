# Incident Dashboard

A full-stack web application for managing and tracking incidents with real-time updates.

## Project Structure

```
├── backend/     # Node.js/Express API server
├── frontend/    # React + Vite frontend
└── .gitignore
```

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Git

## Setup Instructions

### 1. Clone the Repository

```bash
git clone https://github.com/se-akshay/incident-manager.git
cd incident-manager
```

### 2. Backend Setup

Navigate to the backend directory and install dependencies:

```bash
cd backend
npm install
```

Create a `.env` file in the `backend` directory with your configuration:

```
DATABASE_URL=your_database_url
PORT=5000
```

Start the backend server:

```bash
npm start
```

The backend will run on `http://localhost:5000`

### 3. Frontend Setup

In a new terminal, navigate to the frontend directory and install dependencies:

```bash
cd frontend
npm install
```

Start the development server:

```bash
npm run dev
```

The frontend will run on `http://localhost:5173`

## Available Scripts

### Backend

- `npm start` - Start the server
- `npm run dev` - Start with nodemon for development

### Frontend

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

## API Endpoints

Refer to `backend/routes/incidents.js` for available API endpoints.

## Technologies Used

- **Backend**: Node.js, Express
- **Frontend**: React, Vite
- **Database**: MongoDB

## Contributing

Feel free to submit issues and enhancement requests!

## License

MIT
