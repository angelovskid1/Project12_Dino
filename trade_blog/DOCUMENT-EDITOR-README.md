# Document Editor with PDF Export

A feature-rich web-based document editor with rich text formatting, image support, and PDF export capabilities.

## Features

### Rich Text Editor
- **Quill Editor**: Lightweight, open-source rich text editor with no API key required
- **Text Formatting**: Bold, italic, underline, strikethrough
- **Headers**: Support for H1, H2, and H3 headings
- **Lists**: Ordered and bulleted lists
- **Code Support**: Blockquotes and code blocks
- **Text Alignment**: Left, center, and right alignment
- **Media**: Insert links and images
- **Undo/Redo**: Full undo and redo functionality

### Section Management
- **Add Sections**: Create multiple document sections with a single button
- **Section Titles**: Each section has its own title field for organization
- **Remove Sections**: Delete sections (except the first one) with the remove button
- **Multiple Editors**: Each section has an independent rich text editor

### Image Drag & Drop
- **Drag Images**: Simply drag image files from your file explorer onto the editor
- **Visual Feedback**: Blue dashed zone appears when dragging images over the editor
- **Auto-Insert**: Images are automatically inserted at the cursor position
- **Inline Preview**: Images display seamlessly with text in the editor
- **Styled Display**: Images have rounded corners and subtle shadows for a polished look
- **PDF Compatible**: All images are included when exporting to PDF

### Auto-Save & Data Caching
- **Automatic Saving**: Content is automatically saved to browser's local storage whenever you type or make changes
- **Persistent Storage**: All section titles, text formatting, and images are saved
- **Auto-Restore**: When you refresh the page, all your content is automatically restored
- **No Data Loss**: Your work is preserved even if you accidentally close the browser
- **Clear Cache**: Manually clear all saved data with a single button click (with confirmation)

**What Gets Saved:**
- Section titles
- All editor content (text, formatting, images)
- Number of sections
- Complete document structure

### PDF Export
- **One-Click Export**: Export your entire document as a PDF with a single button
- **Professional Formatting**: Maintains all text formatting, images, and layouts
- **Multi-Section Support**: All sections are included in the PDF
- **Page Breaks**: Sections use page-break-inside to prevent awkward splits
- **Download**: PDF is automatically downloaded to your computer

## How to Use

### Creating Content
1. Enter a title for the first section
2. Click in the editor area and start typing
3. Use the toolbar buttons for text formatting, lists, links, and images
4. Add more sections by clicking the "+ Add Section" button

### Adding Images
1. Drag image files from your file explorer
2. Drop them onto the editor area (a blue dashed zone will appear)
3. Images will be automatically inserted at the cursor position
4. Alternatively, use the image button in the toolbar

### Saving Your Work
- Your document is automatically saved to the browser's local storage
- No manual save action is required
- Refresh the page anytime—your content will be restored

### Exporting to PDF
1. Click the "📥 Export PDF" button in the header
2. The system will generate and download your document as a PDF
3. The PDF will include all sections, formatting, and images

### Clearing Cache
1. Click the "🗑️ Clear Cache" button
2. Confirm the action when prompted
3. All saved data will be cleared and the page will refresh

## Browser Compatibility

This application works on all modern browsers that support:
- LocalStorage API
- FileReader API
- HTML5 Canvas (for PDF export)
- CSS Grid and Flexbox

Tested on:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Technical Stack

- **Editor**: Quill.js - Open-source rich text editor
- **PDF Export**: html2pdf.js - Client-side PDF generation
- **Storage**: Browser LocalStorage - Client-side data persistence
- **Styling**: Custom CSS with responsive design

## Tips & Tricks

- **Keyboard Shortcuts**: Use standard shortcuts like Ctrl+B (Bold), Ctrl+I (Italic), Ctrl+Z (Undo)
- **Nested Lists**: Create nested lists by pressing Tab within a list item
- **Code Blocks**: Use code blocks for displaying code snippets
- **Multiple Images**: Drag multiple images at once—they'll all be inserted
- **Text Formatting**: Use the toolbar or keyboard shortcuts for quick formatting
- **Responsive Design**: The editor works on mobile and tablet devices

## Storage Limits

Browser LocalStorage typically allows:
- **Chrome/Firefox/Edge**: ~10 MB per origin
- **Safari**: ~5 MB per origin
- **IE**: ~10 MB per origin

Large documents with many high-resolution images may approach these limits. In such cases, regularly export to PDF and consider starting a new document.

## Browser DevTools

To view or manage your saved data:
1. Open DevTools (F12)
2. Go to Application tab
3. Click LocalStorage
4. Find "documentEditorData" key
5. Edit or delete as needed

## Privacy

All data is stored locally in your browser. No information is sent to external servers. The application works completely offline.

## License

This document editor uses open-source libraries:
- Quill.js (BSD 3-Clause License)
- html2pdf.js (MIT License)

## Support

For issues or feature requests, ensure you're using a modern browser and that LocalStorage is enabled in your browser settings.
