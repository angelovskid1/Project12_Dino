# Project 12: Extending the Trading Blog System

This project involves extending the existing trading blog system to support database-backed blog articles, dynamic media storage, and blog management capabilities.

## Overview of Features

1. **SQLite Database Integration**:
   - Implemented a backend `server.js` using Node.js and Express.
   - Initialized a local SQLite database (`watchlist.db`) containing tables for `blogs` and `images`.

2. **Blog Creation & Editing**:
   - Users can write and edit blogs with rich text and images via the `document-editor.html` interface.
   - Creating or updating a blog uses a custom, modern popup modal for the title instead of standard browser alerts.
   - Base64 image data embedded in the rich text is automatically extracted on the backend, stored efficiently as BLOBs in the `images` table, and served dynamically.

3. **Frontend Views**:
   - **Editor Navigation**: A dynamic left panel in `document-editor.html` displays a list of created blog articles.
   - **Reader View**: A `blog.html` page to individually view rendered blog articles. It includes an "Edit" button to seamlessly jump back into the editor and update the article.
   - **Admin Panel**: An `admin.html` page to manage (view and delete) blogs.

## How to Run
1. Navigate to the `Dino_Project 12_Extending_the_Trading_Blog_System` directory.
2. Run `npm install` (if dependencies are not yet installed).
3. Start the server with `node server.js`.
4. Open `trade_blog/document-editor.html` in your web browser.
