# Trade Logging System

A web-based trade logging and analysis application with SQLite database support.

## Features

- **CSV Upload**: Load watchlist data from CSV files
- **Database Save/Load**: Save and load watchlist data to/from SQLite database (`watchlist.db`)
- **Auto-grouping**: Index ETFs (SPY, QQQ, VOO, TQQQ) and Sector ETFs (XL*) are automatically grouped at the top
- **Daily/Weekly/Monthly Tracking**: Track trading signals for each symbol
- **Comments**: Add comments to each symbol
- **Search**: Filter symbols with wildcard support
- **Print to PDF**: Generate printable reports
- **Local Caching**: Browser cache for offline access

## Setup & Installation

### Prerequisites
- Node.js (v14 or higher)
- npm

### Installation Steps

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

The server will start on `http://localhost:3000`

## Usage

### Loading Data
- **From CSV**: Click the file input, select a CSV file
- **From Database**: Click the "Load from DB" button to load previously saved data

### Saving Data
- **To Database**: Click "Save to DB" button to persist data to SQLite
- **To Cache**: Changes are automatically saved to browser cache
- **To PDF**: Click "Print to PDF" for a printable report

## Database Schema (JSON-based)

The SQLite database now uses a JSON-based schema with three main tables:

### 1. `watchlist_snapshots` - Complete Dataset Snapshots
Stores complete watchlist snapshots in JSON format with metadata.

```sql
CREATE TABLE watchlist_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    snapshot_name TEXT,
    snapshot_data JSON NOT NULL,
    metadata JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    notes TEXT
)
```

**Example `snapshot_data` JSON:**
```json
{
  "total_symbols": 33,
  "timestamp": "2026-01-13T10:30:45.123Z",
  "data": [
    {
      "Symbol": "SPY",
      "Daily": "Buy",
      "Weekly": "Neutral",
      "Monthly": "Hold",
      "Comment": "Strong uptrend",
      "Skip": "false"
    },
    ...
  ]
}
```

**Example `metadata` JSON:**
```json
{
  "record_count": 33,
  "index_etfs": 4,
  "sector_etfs": 10,
  "completed_symbols": 5,
  "skipped_symbols": 2
}
```

### 2. `symbols` - Individual Symbol Details
Stores each symbol's data as a JSON document for flexible queries.

```sql
CREATE TABLE symbols (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL UNIQUE,
    symbol_data JSON NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

**Example `symbol_data` JSON:**
```json
{
  "symbol": "AAPL",
  "daily": "Buy",
  "weekly": "Neutral",
  "monthly": "Hold",
  "comment": "Tech leader",
  "skip": false,
  "status": {
    "completed": true,
    "skipped": false
  }
}
```

### 3. `history` - Audit Log
Tracks all changes and actions for auditing.

```sql
CREATE TABLE history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL,
    symbol TEXT,
    change_data JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

**Example `change_data` JSON:**
```json
{
  "symbols_count": 33,
  "timestamp": "2026-01-13T10:30:45.123Z"
}
```

### CSV Format

The CSV file should have the following columns:
```
Symbol,Daily,Weekly,Monthly
SPY,,,
QQQ,,,
AAPL,,,
...
```

Optional columns:
- `Comment`: Add notes for each symbol
- `Skip`: Set to "true" to skip a symbol

## API Endpoints

### POST /api/save-watchlist
Save complete watchlist data as a JSON snapshot. Automatically creates:
- A snapshot record with all data
- Individual symbol records
- History log entry

**Request:**
```json
{
  "data": [
    {
      "Symbol": "SPY",
      "Daily": "Buy",
      "Weekly": "Neutral",
      "Monthly": "",
      "Comment": "Strong uptrend",
      "Skip": "false"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully saved 33 records to database",
  "snapshot_id": "snapshot_1705070000000",
  "metadata": {
    "record_count": 33,
    "index_etfs": 4,
    "sector_etfs": 10,
    "completed_symbols": 5,
    "skipped_symbols": 2
  }
}
```

### GET /api/load-watchlist
Load the latest watchlist snapshot from the database.

**Response:**
```json
{
  "success": true,
  "data": [...],
  "count": 33,
  "metadata": {...},
  "snapshot_created": "2026-01-13T10:30:45.000Z"
}
```

### GET /api/snapshots
Retrieve all saved snapshots (limited to last 20).

**Response:**
```json
{
  "success": true,
  "snapshots": [
    {
      "id": 5,
      "name": "snapshot_1705070000000",
      "metadata": {...},
      "created_at": "2026-01-13T10:30:45.000Z"
    }
  ],
  "count": 5
}
```

### GET /api/snapshot/:id
Load a specific snapshot by ID.

**Response:**
```json
{
  "success": true,
  "snapshot_id": 5,
  "data": [...],
  "metadata": {...},
  "created_at": "2026-01-13T10:30:45.000Z"
}
```

### GET /api/db-info
Get database statistics and information.

**Response:**
```json
{
  "success": true,
  "dbPath": "/path/to/watchlist.db",
  "tables": {
    "snapshots": 5,
    "symbols": 33,
    "history": 12
  }
}
```

### POST /api/clear-database
Clear all tables from the database.

**Response:**
```json
{
  "success": true,
  "message": "All database tables cleared"
}
```

## Notes

- The application automatically groups Index ETFs at the top, followed by Sector ETFs
- All changes are automatically cached in the browser
- Database saves are persistent across browser sessions
- The database file can be backed up by copying `watchlist.db`
