# Intern Report: Project 12 - Extending the Trading Blog System

**Date:** February 26, 2026
**Assignee:** Dino
**Project:** Project 12

## Objectives
The primary goal was to enhance the existing Trading Blog tool by moving from a static or purely client-side system to a more robust, database-backed architecture using Node.js and SQLite.

## Accomplishments

1. **Database Architecture**:
   - Designed and implemented SQLite tables (`blogs` and `images`) to store article content and associated media separately.
   - Configured robust REST API endpoints in Express to handle CRUD operations for blogs and images.

2. **Image Handling**:
   - Addressed the issue of oversized data persistence by intelligently parsing heavy Base64 image tags out of the HTML payload before saving the text to the `blogs` table.
   - Saved the raw Base64 data as BLOBs in the `images` table and dynamically replaced the source URLs with our `/api/images/:id` endpoint.

3. **User Interface Enhancements**:
   - **Left Panel Navigation**: Appended a sidebar to the document editor displaying an autoupdating feed of recent blogs.
   - **Admin Management**: Engineered an intuitive `admin.html` tool, enabling effortless deletion of blogs, with SQLite cascade deletion handling the cleanup of orphaned images.
   - **Dedicated Reader View**: Programmed `blog.html` for clean, isolated reading of posts.
   - **Custom Title Modal**: Replaced standard browser prompts with a modern, beautifully styled HTML modal popup for blog title creation.
   - **Blog Editing Flow**: Added an "Edit" button to the article reader view, which dynamically reloads the original content back into the rich-text editor, changes the UI to an "Update Blog" mode, and saves updates efficiently via a new `PUT` API endpoint.

## Challenges & Solutions
- **Base64 String Management**: Handling large payload sizes through Express caused initial constraints. I resolved this by increasing the Express `bodyParser.json({limit: '50mb'})` thresholds and structuring an elegant regex parser on the server side to swap heavy Base64 strings for tiny API endpoints.

## Future Recommendations
- Implement user authentication to secure the admin panel and blog creation APIs.
